import { OrderStatus } from '@/enums/order.enum';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { BaseSchema } from './base.schema';
import { CustomerDocument } from './customer.schema';
import { ServiceServer } from './service-server.schema';
import { Service } from './service.schema';

export type OrderDocument = HydratedDocument<Order>;
export interface IProductDetail {
    targetId: string;
    initialCount: number;
    completedCount: number;
}

export interface ILikePostPageDetail {
    postId: string;
    initialCount: number;
    completedCount: number;
    page: {
        id: string;
        name: string;
        accessToken: string;
    };
}

@Schema({ timestamps: true })
export class Order extends BaseSchema {
    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true })
    customer: CustomerDocument;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Service' })
    service: Service;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'ServiceServer', required: true })
    server: ServiceServer;

    // link bài viết
    @Prop()
    link?: string;

    // số lượng sub đã có trước khi order
    @Prop({ default: 0 })
    startCount: number;

    // số lượng sub cần order
    @Prop({ required: true })
    quantity: number;

    // giá tiền
    @Prop({ required: true })
    price: number;

    // trạng thái order
    @Prop({ required: true })
    status: OrderStatus;

    // số lượng đã hoàn thành
    @Prop({ default: 0, required: true })
    completedCount: number;

    // tổng tiền thanh toán
    @Prop({ required: true })
    totalPayment: number;

    @Prop({})
    smmOrderId?: string;

    @Prop()
    note?: string;

    // đã hoàn tiền
    @Prop({ default: false })
    refunded: boolean;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
