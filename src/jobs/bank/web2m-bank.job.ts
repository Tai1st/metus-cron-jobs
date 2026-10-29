import { envFlag, getErrorMessage, SingleFlight } from '@/common/utils';
import { SettingKey } from '@/enums/common.enum';
import { DiscordProvider } from '@/providers/discord/discord.provider';
import { Setting } from '@/schemas';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { BankTransaction, isIncoming } from './bank.types';
import { DepositLedgerService } from './deposit-ledger.service';
import { DepositService } from './deposit.service';

interface Web2MTransaction {
    transactionNumber: string;
    amount: number | string;
    description: string;
    postingDate: string;
    type: string;
    account: string;
}

interface Web2MTransactionResponse {
    success: boolean;
    message: string;
    transactions: Web2MTransaction[];
}

/** Nạp tiền tự động: đọc lịch sử giao dịch tài khoản ACB của Metus qua Web2M. */
@Injectable()
export class Web2mBankJob {
    private readonly logger = new Logger(Web2mBankJob.name);
    private readonly flight = new SingleFlight();

    constructor(
        private readonly http: HttpService,
        private readonly discord: DiscordProvider,
        private readonly ledger: DepositLedgerService,
        private readonly deposit: DepositService,
        @InjectModel(Setting.name) private readonly settingModel: Model<Setting>,
    ) {}

    @Cron('*/10 * * * * *')
    async run(): Promise<void> {
        if (!envFlag('JOB_BANK_ENABLE', true)) {
            return;
        }
        await this.flight.run(() => this.checkTransactions());
    }

    private async checkTransactions(): Promise<void> {
        try {
            const setting = await this.settingModel.findOne({ key: SettingKey.BANK_ACCOUNT });
            const web2mToken = setting?.value?.web2mToken;
            if (!web2mToken) {
                throw new Error('Chưa cấu hình web2mToken trong setting BANK_ACCOUNT');
            }

            const { data } = await firstValueFrom(
                this.http.get<Web2MTransactionResponse>(`https://api.web2m.com/historyapiopenacb/${web2mToken}`),
            );
            if (!Array.isArray(data?.transactions)) {
                throw new Error(`Web2M trả về dữ liệu không hợp lệ: ${data?.message ?? 'không có transactions'}`);
            }

            const incoming = data.transactions.map((t) => this.normalize(t)).filter(isIncoming);
            for (const tx of await this.ledger.filterUnseen(incoming)) {
                await this.process(tx);
            }
        } catch (error) {
            // Không in nguyên object lỗi: URL Web2M chứa token.
            const message = `[Web2mBankJob] CheckTransaction error: ${getErrorMessage(error)}`;
            this.logger.error(message);
            await this.discord.sendToError(message);
        }
    }

    private async process(tx: BankTransaction): Promise<void> {
        try {
            if (!(await this.ledger.claim(tx))) {
                return;
            }
            // Đã giành quyền xử lý: nếu lỗi sau đây thì KHÔNG tự thử lại (tránh cộng trùng), báo admin xử lý tay.
            try {
                await this.deposit.creditMetus(tx);
            } catch (error) {
                const message = `🚨 Lỗi khi cộng tiền giao dịch ${tx.transactionNumber} (${tx.amount}đ, "${tx.description}"): ${getErrorMessage(error)}. Kiểm tra và xử lý thủ công.`;
                this.logger.error(message);
                await this.discord.sendToTransaction(message);
            }
        } catch (error) {
            this.logger.error(`Không ghi nhận được giao dịch ${tx.transactionNumber}: ${getErrorMessage(error)}`);
        }
    }

    private normalize(raw: Web2MTransaction): BankTransaction {
        return {
            transactionNumber: Number(raw.transactionNumber),
            amount: Number(raw.amount),
            description: raw.description ?? '',
            postingDate: Number(raw.postingDate) || Date.parse(raw.postingDate) || 0,
            type: raw.type,
            account: Number(raw.account),
        };
    }
}
