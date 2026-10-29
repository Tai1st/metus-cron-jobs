import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { BaseSchema } from './base.schema';
import { Customer } from './customer.schema';

export type UsdtTransactionDocument = HydratedDocument<UsdtTransaction>;

export enum UsdtTransactionStatus {
    // Đã nhận diện, đang xử lý.
    PROCESSING = 'PROCESSING',
    CREDITED = 'CREDITED',
    // Không ra khách nào (số lẻ không có trong hệ thống, số tiền chẵn) hoặc dưới mức tối thiểu: xử lý tay.
    UNMATCHED = 'UNMATCHED',
    // Số lẻ trùng của nhiều khách: không tự cộng, xử lý tay.
    AMBIGUOUS = 'AMBIGUOUS',
    // Ra khách nhưng cộng tiền lỗi: xử lý tay.
    ERROR = 'ERROR',
}

/** Sổ các giao dịch nạp USDT đã thấy trên Binance. `txId` unique để mỗi giao dịch chỉ xử lý một lần. */
@Schema({ timestamps: true, collection: 'usdt_transactions' })
export class UsdtTransaction extends BaseSchema {
    @Prop({ required: true, unique: true })
    txId: string;

    @Prop()
    network: string;

    @Prop()
    address: string;

    // Số USDT Binance ghi nhận, giữ nguyên dạng chuỗi để không mất độ chính xác.
    @Prop()
    amount: string;

    @Prop()
    insertTime: number;

    @Prop({ default: UsdtTransactionStatus.PROCESSING })
    status: UsdtTransactionStatus;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' })
    customer?: Customer;

    // Số VND đã quy đổi (chưa gồm khuyến mại) khi cộng thành công.
    @Prop()
    vndAmount?: number;

    @Prop()
    note?: string;
}

export const UsdtTransactionSchema = SchemaFactory.createForClass(UsdtTransaction);
