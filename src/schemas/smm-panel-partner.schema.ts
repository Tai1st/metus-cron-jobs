import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseSchema } from './base.schema';

export type SmmPanelPartnerDocument = HydratedDocument<SmmPanelPartner>;
export enum SmmPanelPartnerStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
}

export enum SmmPanelPartnerCurrency {
    USD = 'usd',
    VND = 'vnd',
}
@Schema({ timestamps: true, collection: 'smm_panel_partners' })
export class SmmPanelPartner extends BaseSchema {
    @Prop()
    name: string;

    @Prop()
    link: string;

    @Prop()
    token: string;

    @Prop()
    balance: number;

    @Prop()
    status: SmmPanelPartnerStatus;

    @Prop()
    currency: SmmPanelPartnerCurrency;
}

export const SmmPanelPartnerSchema = SchemaFactory.createForClass(SmmPanelPartner);
