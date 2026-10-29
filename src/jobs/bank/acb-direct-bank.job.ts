import { envFlag, getErrorMessage, SingleFlight } from '@/common/utils';
import { SettingKey } from '@/enums/common.enum';
import { DiscordProvider } from '@/providers/discord/discord.provider';
import { Setting, Site, SiteDocument } from '@/schemas';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { BankTransaction, isIncoming } from './bank.types';
import { DepositLedgerService } from './deposit-ledger.service';
import { DepositService } from './deposit.service';

const ACB_AUTH_URL = 'https://apiapp.acb.com.vn/mb/v2/auth/tokens';
const ACB_HISTORY_URL = 'https://apiapp.acb.com.vn/mb/legacy/ss/cs/bankservice/saving/tx-history?maxRows=20';
// Dùng lại access token thay vì đăng nhập ACB mỗi 10 giây (dễ bị khoá tài khoản / rate-limit).
const TOKEN_TTL_MS = 4 * 60 * 1000;

/**
 * Nạp tiền theo từng site: đăng nhập thẳng ACB bằng tài khoản của site.
 * Mặc định TẮT (JOB_AUTO_BANK_ENABLE=false); hiện chỉ dùng Web2M.
 */
@Injectable()
export class AcbDirectBankJob {
    private readonly logger = new Logger(AcbDirectBankJob.name);
    private readonly flight = new SingleFlight();
    private readonly tokens = new Map<string, { token: string; expiresAt: number }>();

    constructor(
        private readonly http: HttpService,
        private readonly discord: DiscordProvider,
        private readonly ledger: DepositLedgerService,
        private readonly deposit: DepositService,
        @InjectModel(Setting.name) private readonly settingModel: Model<Setting>,
        @InjectModel(Site.name) private readonly siteModel: Model<SiteDocument>,
    ) {}

    @Cron('*/10 * * * * *')
    async run(): Promise<void> {
        if (!envFlag('JOB_AUTO_BANK_ENABLE', false)) {
            return;
        }
        await this.flight.run(async () => {
            const sites = await this.siteModel.find({ active: true });
            for (const site of sites) {
                await this.checkSite(site);
            }
        });
    }

    private async checkSite(site: SiteDocument): Promise<void> {
        try {
            if (!site.bankAccount || !site.bankPassword) {
                throw new Error('Không tìm thấy tài khoản bank của site');
            }
            const token = await this.getToken(site);
            const { data } = await firstValueFrom(
                this.http.get(ACB_HISTORY_URL, { headers: { Authorization: `Bearer ${token}` } }),
            );
            if (!Array.isArray(data?.data)) {
                throw new Error('ACB trả về dữ liệu giao dịch không hợp lệ');
            }

            const incoming = (data.data as AnyObject[]).map((t) => this.normalize(t)).filter(isIncoming);
            for (const tx of await this.ledger.filterUnseen(incoming)) {
                await this.process(site, tx);
            }
        } catch (error) {
            this.tokens.delete(site.id);
            const message = `[AcbDirectBankJob][${site.domain}] CheckTransaction error: ${getErrorMessage(error)}`;
            this.logger.error(message);
            await this.discord.sendToError(message);
        }
    }

    private async process(site: SiteDocument, tx: BankTransaction): Promise<void> {
        try {
            if (!(await this.ledger.claim(tx))) {
                return;
            }
            try {
                await this.deposit.creditSite(site, tx);
            } catch (error) {
                const message = `🚨 [${site.domain}] Lỗi khi cộng tiền giao dịch ${tx.transactionNumber} (${tx.amount}đ, "${tx.description}"): ${getErrorMessage(error)}. Kiểm tra và xử lý thủ công.`;
                this.logger.error(message);
                await this.discord.sendToTransaction(message);
            }
        } catch (error) {
            this.logger.error(`Không ghi nhận được giao dịch ${tx.transactionNumber}: ${getErrorMessage(error)}`);
        }
    }

    private async getToken(site: SiteDocument): Promise<string> {
        const cached = this.tokens.get(site.id);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.token;
        }

        const setting = await this.settingModel.findOne({ key: SettingKey.BANK_ACCOUNT });
        const clientId = setting?.value?.clientId;
        if (!clientId) {
            throw new Error('Chưa cấu hình clientId trong setting BANK_ACCOUNT');
        }
        const { data } = await firstValueFrom(
            this.http.post(ACB_AUTH_URL, { clientId, username: site.bankAccount, password: site.bankPassword }),
        );
        if (!data?.accessToken) {
            throw new Error('ACB không trả về accessToken');
        }
        this.tokens.set(site.id, { token: data.accessToken, expiresAt: Date.now() + TOKEN_TTL_MS });
        return data.accessToken;
    }

    private normalize(raw: AnyObject): BankTransaction {
        return {
            ...raw,
            transactionNumber: Number(raw.transactionNumber),
            amount: Number(raw.amount),
            description: raw.description ?? '',
        };
    }
}
