import { BANK_CODE, REFERRAL_RATE } from '@/common/constants';
import { escapeRegExp } from '@/common/utils';
import { CustomerActivity, SettingKey, TransactionStatus, TransactionType } from '@/enums/common.enum';
import { CustomerPartnerLevel } from '@/enums/customer.enum';
import { DiscordProvider } from '@/providers/discord/discord.provider';
import { Action, Customer, CustomerDocument, Setting, Site, Transaction } from '@/schemas';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BankTransaction } from './bank.types';

// Phần đại lý được giữ lại (hoa hồng) theo cấp: CTV 20%, Đại lý 30%, NPP 40%.
const PARTNER_DISCOUNT_RATE: Record<number, number> = {
    [CustomerPartnerLevel.COLLABORATORS]: 0.2,
    [CustomerPartnerLevel.AGENCY]: 0.3,
    [CustomerPartnerLevel.DISTRIBUTOR]: 0.4,
};

/** Logic cộng tiền cho khách. Chỉ gọi sau khi `DepositLedgerService.claim` thành công. */
@Injectable()
export class DepositService {
    private readonly logger = new Logger(DepositService.name);

    constructor(
        private readonly discord: DiscordProvider,
        @InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>,
        @InjectModel(Action.name) private readonly actionModel: Model<Action>,
        @InjectModel(Setting.name) private readonly settingModel: Model<Setting>,
        @InjectModel(Transaction.name) private readonly transactionModel: Model<Transaction>,
    ) {}

    /** Mã nạp = prefix + ký tự chữ/số trong nội dung chuyển khoản (không phân biệt hoa thường). */
    extractBankCode(description: string, prefix: string): string | null {
        if (!description || !prefix) {
            return null;
        }
        const match = description.toLowerCase().match(new RegExp(`${escapeRegExp(prefix.toLowerCase())}\\w+`));
        return match ? match[0] : null;
    }

    /** Nạp tiền vào hệ thống Metus (có khuyến mại + hoa hồng giới thiệu). */
    async creditMetus(tx: BankTransaction): Promise<void> {
        const bankCode = this.extractBankCode(tx.description, BANK_CODE.PREFIX);
        if (!bankCode) {
            await this.notify(
                `[METUS] \n🚫 Không tìm thấy mã nạp với nội dung: ${tx.description}, số tiền ${tx.amount}`,
                'error',
            );
            return;
        }

        const bankInfo = await this.settingModel.findOne({ key: SettingKey.BANK_INFO });
        const promotionPercentage = Number(bankInfo?.value?.depositPromotion) || 0;
        const promotionAmount = Math.round((tx.amount * promotionPercentage) / 100);
        const totalAmount = tx.amount + promotionAmount;

        // Mặc định trả về document TRƯỚC khi cập nhật => customer.balance chính là số dư cũ.
        const customer = await this.customerModel.findOneAndUpdate(
            { bankCode },
            { $inc: { balance: totalAmount, totalDeposit: tx.amount } },
        );
        if (!customer) {
            await this.notify(
                `[METUS] \n⚠️ Không tìm thấy tài khoản có bank code là [${bankCode}], số tiền: ${tx.amount}`,
            );
            return;
        }

        await this.transactionModel.create({
            transactionNumber: tx.transactionNumber,
            amount: tx.amount,
            promotionAmount,
            totalAmount,
            description: tx.description,
            status: TransactionStatus.SUCCESS,
            oldBalance: customer.balance,
            customer: customer._id,
            type: TransactionType.RECHARGE,
        });
        await this.actionModel.create({ activity: CustomerActivity.RECHARGE, ip: '::1', customer: customer.id });

        if (customer.ref) {
            await this.payReferral(customer, tx);
        }

        await this.notify(
            `[METUS] \n✅ [${bankCode}] [${customer.email}] đã nạp thành công. \n💰 Tiền thực nhận: ${tx.amount} \n💵 Khuyến mại ${promotionPercentage}%: ${promotionAmount} \n🤑 Tổng tiền: ${totalAmount}`,
        );
    }

    /** Nạp tiền cho khách của một site: cộng 100% cho khách, trừ đại lý theo cấp. */
    async creditSite(site: Site, tx: BankTransaction): Promise<void> {
        const bankCode = this.extractBankCode(tx.description, site.bankPrefix);
        if (!bankCode) {
            await this.notify(
                `[${site.domain}] 🚫 Không tìm thấy mã nạp với nội dung: ${tx.description}, số tiền ${tx.amount}`,
                'error',
            );
            return;
        }

        const customer = await this.customerModel
            .findOneAndUpdate({ bankCode }, { $inc: { balance: tx.amount } })
            .populate('ref');
        if (!customer) {
            await this.notify(
                `[${site.domain}] ⚠️ Không tìm thấy tài khoản có bank code là [${bankCode}], số tiền: ${tx.amount}`,
            );
            return;
        }

        await this.transactionModel.create({
            transactionNumber: tx.transactionNumber,
            amount: tx.amount,
            totalAmount: tx.amount,
            description: tx.description,
            status: TransactionStatus.SUCCESS,
            oldBalance: customer.balance,
            customer: customer._id,
            type: TransactionType.RECHARGE,
        });
        await this.actionModel.create({ activity: CustomerActivity.RECHARGE, ip: '::1', customer: customer.id });

        const agent = customer.ref;
        if (!agent) {
            await this.notify(
                `[${site.domain}] ⚠️ [${bankCode}] [${customer.email}] đã nạp ${tx.amount} nhưng khách không có đại lý để trừ tiền.`,
            );
            return;
        }

        const agentCharge = Math.round(tx.amount - this.partnerDiscount(agent.partnerLevel, tx.amount));
        const agentBefore = await this.customerModel.findByIdAndUpdate(agent, { $inc: { balance: -agentCharge } });
        if (agentBefore) {
            await this.transactionModel.create({
                transactionNumber: tx.transactionNumber,
                amount: -agentCharge,
                description: `trừ tiền khách hàng ${customer.email} nạp tiền cho ${site.domain}`,
                status: TransactionStatus.SUCCESS,
                oldBalance: agentBefore.balance,
                customer: agentBefore._id,
                type: TransactionType.RECHARGE,
            });
        }

        await this.notify(
            `[${site.domain}] ✅ [${bankCode}] [${customer.email}] đã nạp thành công. \n💰 Tiền thực nhận: ${tx.amount} \nĐại lý cấp ${agent.partnerLevel}: ${agent.email} \nTiền ĐL trừ: ${agentCharge}`,
        );
    }

    /** Hoa hồng giới thiệu: 10% số tiền gốc cho người giới thiệu. */
    private async payReferral(customer: CustomerDocument, tx: BankTransaction): Promise<void> {
        const refAmount = Math.round(tx.amount * REFERRAL_RATE);
        const refBefore = await this.customerModel.findByIdAndUpdate(customer.ref, { $inc: { balance: refAmount } });
        if (!refBefore) {
            return;
        }
        await this.transactionModel.create({
            transactionNumber: tx.transactionNumber,
            amount: refAmount,
            description: `nhận ${refAmount} tiền hoa hồng từ ${customer.email}`,
            status: TransactionStatus.SUCCESS,
            oldBalance: refBefore.balance,
            customer: refBefore._id,
            type: TransactionType.AFFILIATE,
        });
    }

    private partnerDiscount(partnerLevel: number, amount: number): number {
        return Math.round(amount * (PARTNER_DISCOUNT_RATE[partnerLevel] ?? 0));
    }

    private async notify(text: string, level: 'warn' | 'error' = 'warn'): Promise<void> {
        this.logger[level](text);
        await this.discord.sendToTransaction(text);
    }
}
