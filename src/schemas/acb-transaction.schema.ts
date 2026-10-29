import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { BaseSchema } from './base.schema';

export type AcbTransactionDocument = HydratedDocument<AcbTransaction>;

@Schema({ timestamps: true })
export class AcbTransaction extends BaseSchema {
    @Prop()
    amount: number;

    @Prop()
    accountName: string;

    @Prop()
    receiverName: string;

    @Prop()
    transactionNumber: number;

    @Prop()
    description: string;

    @Prop()
    bankName: string;

    @Prop()
    isOnline: boolean;

    @Prop()
    postingDate: number;

    @Prop()
    accountOwner: mongoose.Schema.Types.Mixed;

    @Prop()
    type: string;

    @Prop()
    receiverAccountNumber: string;

    @Prop()
    currency: string;

    @Prop()
    account: number;

    @Prop()
    activeDatetime: number;

    @Prop()
    effectiveDate: number;
}

export const AcbTransactionSchema = SchemaFactory.createForClass(AcbTransaction);
// Chặn cộng tiền trùng: mỗi giao dịch ngân hàng chỉ được ghi nhận một lần.
AcbTransactionSchema.index({ transactionNumber: 1 }, { unique: true });
