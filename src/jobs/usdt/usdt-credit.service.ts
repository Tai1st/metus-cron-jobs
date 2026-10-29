import { REFERRAL_RATE } from '@/common/constants';
import { CustomerActivity, SettingKey, TransactionStatus, TransactionType } from '@/enums/common.enum';
import { TelegramProvider } from '@/providers/telegram/telegram.provider';
import { Action, Customer, CustomerDocument, Setting, Transaction } from '@/schemas';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { usdtToVnd } from './usdt-amount';

export interface UsdtCreditInput {
    customerId: Types.ObjectId;
    /** Số USDT nhận được, đơn vị 1e-6. */
    micro: number;
    network: string;
    txId: string;
    /** VND cho 1 USDT. */
    rate: number;
}

/**
 * Cộng tiền cho khách nạp USDT: quy đổi VND, khuyến mại và hoa hồng giới thiệu giống nạp ngân hàng.
 * Chỉ gọi sau khi đã giành quyền xử lý giao dịch (`txId` unique) nên không bao giờ cộng hai lần.
 */
@Injectable()
export class UsdtCreditService {
    constructor(
        private readonly telegram: TelegramProvider,
        @InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>,
        @InjectModel(Action.name) private readonly actionModel: Model<Action>,
        @InjectModel(Setting.name) private readonly settingModel: Model<Setting>,
        @InjectModel(Transaction.name) private readonly transactionModel: Model<Transaction>,
    ) {}

    /** Trả về số VND đã quy đổi (chưa gồm khuyến mại). */
    async credit({ customerId, micro, network, txId, rate }: UsdtCreditInput): Promise<number> {
        const usdt = micro / 1e6;
        const amount = usdtToVnd(micro, rate);
        const description = `Nạp ${usdt} USDT (${network}) tỉ giá ${rate}, tx ${txId}`;

        const bankInfo = await this.settingModel.findOne({ key: SettingKey.BANK_INFO });
        const promotionPercentage = Number(bankInfo?.value?.depositPromotion) || 0;
        const promotionAmount = Math.round((amount * promotionPercentage) / 100);
        const totalAmount = amount + promotionAmount;

        // Mặc định trả về document TRƯỚC khi cập nhật => customer.balance chính là số dư cũ.
        const customer = await this.customerModel.findOneAndUpdate(
            { _id: customerId },
            { $inc: { balance: totalAmount, totalDeposit: amount } },
        );
        if (!customer) {
            throw new Error(`Không tìm thấy khách ${customerId}`);
        }

        await this.transactionModel.create({
            txId,
            amount,
            promotionAmount,
            totalAmount,
            description,
            status: TransactionStatus.SUCCESS,
            oldBalance: customer.balance,
            customer: customer._id,
            type: TransactionType.RECHARGE,
        });
        await this.actionModel.create({ activity: CustomerActivity.RECHARGE, ip: '::1', customer: customer.id });

        if (customer.ref) {
            await this.payReferral(customer, amount, txId);
        }

        await this.telegram.sendToTransaction(
            `[USDT] \n✅ [${customer.bankCode}] [${customer.email}] đã nạp thành công. \n🪙 ${usdt} USDT (${network}) × ${rate} \n💰 Tiền thực nhận: ${amount} \n💵 Khuyến mại ${promotionPercentage}%: ${promotionAmount} \n🤑 Tổng tiền: ${totalAmount} \n🔗 ${txId}`,
        );
        return amount;
    }

    /** Hoa hồng giới thiệu: 10% số tiền gốc cho người giới thiệu. */
    private async payReferral(customer: CustomerDocument, amount: number, txId: string): Promise<void> {
        const refAmount = Math.round(amount * REFERRAL_RATE);
        const refBefore = await this.customerModel.findByIdAndUpdate(customer.ref, { $inc: { balance: refAmount } });
        if (!refBefore) {
            return;
        }
        await this.transactionModel.create({
            txId,
            amount: refAmount,
            description: `nhận ${refAmount} tiền hoa hồng từ ${customer.email}`,
            status: TransactionStatus.SUCCESS,
            oldBalance: refBefore.balance,
            customer: refBefore._id,
            type: TransactionType.AFFILIATE,
        });
    }
}
