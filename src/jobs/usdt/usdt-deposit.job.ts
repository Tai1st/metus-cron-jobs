import { envFlag, getErrorMessage, SingleFlight } from '@/common/utils';
import { TelegramProvider } from '@/providers/telegram/telegram.provider';
import { UsdtTransaction, UsdtTransactionStatus } from '@/schemas';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { BinanceClient, BinanceDeposit } from './binance.client';
import { parseUsdtAmount } from './usdt-amount';
import { UsdtCreditService } from './usdt-credit.service';
import { UsdtCustomerIndex } from './usdt-customer-index.service';
import { UsdtConfig, UsdtSettingsService } from './usdt-settings.service';

// Chỉ nhận các mạng này, dù Binance hỗ trợ nhiều mạng hơn.
export const USDT_NETWORKS = ['BSC', 'ETH', 'TON', 'TRX'];
// Quét lại 3 ngày gần nhất mỗi lượt; giao dịch cũ đã có trong sổ nên bị bỏ qua.
const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;
// Binance: status 1 = đã ghi có.
const BINANCE_CREDITED = 1;

/** Nạp tiền USDT: quét lịch sử nạp của ví Binance, khớp khách theo số lẻ của số tiền rồi cộng tiền. */
@Injectable()
export class UsdtDepositJob {
    private readonly logger = new Logger(UsdtDepositJob.name);
    private readonly flight = new SingleFlight();

    constructor(
        private readonly binance: BinanceClient,
        private readonly settings: UsdtSettingsService,
        private readonly customers: UsdtCustomerIndex,
        private readonly credit: UsdtCreditService,
        private readonly telegram: TelegramProvider,
        @InjectModel(UsdtTransaction.name) private readonly ledger: Model<UsdtTransaction>,
    ) {}

    @Cron('*/30 * * * * *')
    async run(): Promise<void> {
        if (!envFlag('JOB_USDT_ENABLE', false)) {
            return;
        }
        await this.flight.run(() => this.scan());
    }

    private async scan(): Promise<void> {
        try {
            // Kiểm tra cấu hình TRƯỚC khi giành quyền xử lý giao dịch, để lỗi cấu hình không làm mất giao dịch.
            const config = await this.settings.getConfig();
            const deposits = (await this.binance.depositHistory(Date.now() - LOOKBACK_MS)).filter(
                (d) => d.status === BINANCE_CREDITED && USDT_NETWORKS.includes(d.network),
            );
            for (const deposit of await this.unseen(deposits)) {
                await this.process(deposit, config);
            }
        } catch (error) {
            const message = `[UsdtDepositJob] Scan error: ${getErrorMessage(error)}`;
            this.logger.error(message);
            await this.telegram.sendToError(message);
        }
    }

    private async unseen(deposits: BinanceDeposit[]): Promise<BinanceDeposit[]> {
        if (!deposits.length) {
            return [];
        }
        const seen = await this.ledger
            .find({ txId: { $in: deposits.map((d) => d.txId) } })
            .select('txId')
            .lean();
        const seenIds = new Set(seen.map((t) => t.txId));
        return deposits.filter((d) => !seenIds.has(d.txId));
    }

    private async process(deposit: BinanceDeposit, config: UsdtConfig): Promise<void> {
        if (!(await this.claim(deposit))) {
            return;
        }
        const label = `${deposit.amount} USDT (${deposit.network}) tx ${deposit.txId}`;
        try {
            const parsed = parseUsdtAmount(deposit.amount);
            if (!parsed) {
                return this.settle(deposit, UsdtTransactionStatus.UNMATCHED, `Số tiền không hợp lệ: ${label}`);
            }
            if (parsed.micro < config.minAmount * 1e6) {
                return this.settle(
                    deposit,
                    UsdtTransactionStatus.UNMATCHED,
                    `Dưới mức tối thiểu ${config.minAmount} USDT: ${label}`,
                );
            }

            const found = await this.customers.find(parsed.suffix);
            if (found.status === 'none') {
                return this.settle(
                    deposit,
                    UsdtTransactionStatus.UNMATCHED,
                    `Số lẻ ${parsed.suffix} không thuộc khách nào: ${label}`,
                );
            }
            if (found.status === 'many') {
                const who = found.customers.map((c) => `${c.bankCode} (${c.email})`).join(', ');
                return this.settle(
                    deposit,
                    UsdtTransactionStatus.AMBIGUOUS,
                    `Số lẻ ${parsed.suffix} trùng nhiều khách, KHÔNG tự cộng: ${who}. ${label}`,
                );
            }

            const vndAmount = await this.credit.credit({
                customerId: found.customer.id,
                micro: parsed.micro,
                network: deposit.network,
                txId: deposit.txId,
                rate: config.rate,
            });
            await this.ledger.updateOne(
                { txId: deposit.txId },
                { $set: { status: UsdtTransactionStatus.CREDITED, customer: found.customer.id, vndAmount } },
            );
        } catch (error) {
            // Đã giành quyền xử lý: KHÔNG tự thử lại (tránh cộng trùng), báo admin xử lý tay.
            await this.settle(
                deposit,
                UsdtTransactionStatus.ERROR,
                `Lỗi khi cộng tiền: ${getErrorMessage(error)}. ${label}`,
            );
        }
    }

    /** Ghi trạng thái cuối cho giao dịch không tự cộng được và báo Telegram để xử lý tay. */
    private async settle(deposit: BinanceDeposit, status: UsdtTransactionStatus, note: string): Promise<void> {
        await this.ledger.updateOne({ txId: deposit.txId }, { $set: { status, note } });
        const message = `[USDT] 🚨 ${status}: ${note}`;
        this.logger.warn(message);
        await this.telegram.sendToTransaction(message);
    }

    /** Giành quyền xử lý nguyên tử (upsert + unique `txId`): chỉ một lượt chạy thắng. */
    private async claim(deposit: BinanceDeposit): Promise<boolean> {
        try {
            const result = await this.ledger.updateOne(
                { txId: deposit.txId },
                {
                    $setOnInsert: {
                        network: deposit.network,
                        address: deposit.address,
                        amount: deposit.amount,
                        insertTime: deposit.insertTime,
                        status: UsdtTransactionStatus.PROCESSING,
                    },
                },
                { upsert: true },
            );
            return result.upsertedCount === 1;
        } catch (error) {
            if (error?.code === 11000) {
                return false;
            }
            throw error;
        }
    }
}
