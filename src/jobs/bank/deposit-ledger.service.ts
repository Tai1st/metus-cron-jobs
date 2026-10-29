import { AcbTransaction } from '@/schemas';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BankTransaction } from './bank.types';

/**
 * Sổ ghi nhận giao dịch đã xử lý. `claim` là bước atomic (upsert + unique index):
 * chỉ đúng một lượt chạy giành được giao dịch, nên không bao giờ cộng tiền hai lần.
 */
@Injectable()
export class DepositLedgerService implements OnModuleInit {
    private readonly logger = new Logger(DepositLedgerService.name);

    constructor(@InjectModel(AcbTransaction.name) private readonly acbTransactionModel: Model<AcbTransaction>) {}

    /** Đảm bảo unique index tồn tại. Nếu collection đang có giao dịch trùng thì index không tạo được -> cảnh báo lớn. */
    async onModuleInit(): Promise<void> {
        try {
            await this.acbTransactionModel.createIndexes();
        } catch (error) {
            this.logger.error(
                `KHÔNG tạo được unique index cho acbtransactions.transactionNumber (có thể đang có giao dịch trùng): ${error.message}. Chống cộng tiền trùng KHÔNG đầy đủ cho tới khi xử lý.`,
            );
        }
    }

    /** Lọc ra các giao dịch chưa từng được ghi nhận (truy vấn nhanh, chưa giành quyền xử lý). */
    async filterUnseen(transactions: BankTransaction[]): Promise<BankTransaction[]> {
        if (!transactions.length) {
            return [];
        }
        const seen = await this.acbTransactionModel
            .find({ transactionNumber: { $in: transactions.map((t) => t.transactionNumber) } })
            .select('transactionNumber')
            .lean();
        const seenIds = new Set(seen.map((t) => Number(t.transactionNumber)));
        return transactions.filter((t) => !seenIds.has(t.transactionNumber));
    }

    /** Trả về true nếu lượt gọi này là lượt đầu tiên ghi nhận giao dịch (được phép cộng tiền). */
    async claim(transaction: BankTransaction): Promise<boolean> {
        const { transactionNumber, ...rest } = transaction;
        try {
            const result = await this.acbTransactionModel.updateOne(
                { transactionNumber },
                { $setOnInsert: rest },
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
