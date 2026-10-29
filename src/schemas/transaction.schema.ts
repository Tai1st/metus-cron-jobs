import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { BaseSchema } from './base.schema';
import { Customer } from './customer.schema';
import { TransactionStatus, TransactionType } from '@/enums/common.enum';

export type TransactionDocument = HydratedDocument<Transaction>;

@Schema({ timestamps: true })
export class Transaction extends BaseSchema {
    @Prop()
    amount: number;

    @Prop()
    promotionAmount: number;

    @Prop()
    totalAmount: number;

    @Prop()
    transactionNumber: number;

    @Prop()
    description: string;

    @Prop()
    oldBalance: number;

    @Prop()
    status: TransactionStatus;

    @Prop()
    type: TransactionType;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' })
    customer: Customer;
}

export const transactionSchema = SchemaFactory.createForClass(Transaction);
