import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { BaseSchema } from './base.schema';
import { Service } from './service.schema';
import { SmmPanelPartnerDocument } from './smm-panel-partner.schema';

export type ServiceServerDocument = HydratedDocument<ServiceServer>;

export enum ServiceServerStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
}

@Schema({ timestamps: true, collection: 'service_servers' })
export class ServiceServer extends BaseSchema {
    @Prop()
    name: string;

    @Prop({ required: true })
    serverNumber: number;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true })
    service: Service;

    @Prop()
    price: number;

    // giá cho cộng tác viên
    @Prop()
    priceCollaborator: number;

    // giá cho đại lý
    @Prop()
    priceAgency: number;

    // giá cho nhà phân phối
    @Prop()
    priceDistributor: number;

    @Prop()
    min: number;

    @Prop()
    max: number;

    @Prop()
    status: ServiceServerStatus;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'SmmPanelPartner' })
    smmPanelPartner: SmmPanelPartnerDocument;

    // id server gốc
    @Prop()
    smmServer: number;

    // giá server gốc
    @Prop()
    smmPrice: number;

    // phần trăm tăng giá so với giá gốc
    @Prop({ default: 0.7 })
    percentPrice: number;

    @Prop()
    description: string;
}

export const ServiceServerSchema = SchemaFactory.createForClass(ServiceServer);
