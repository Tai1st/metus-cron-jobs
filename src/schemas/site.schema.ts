import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { BaseSchema } from './base.schema';
import { Customer } from './customer.schema';

export type SiteDocument = HydratedDocument<Site>;

@Schema({ timestamps: true })
export class Site extends BaseSchema {
    @Prop()
    name: string;

    @Prop()
    description: string;

    @Prop()
    logo: string;

    @Prop()
    image: string;

    @Prop()
    domain: string;

    @Prop()
    subdomain: string;

    @Prop()
    customDomain: string;

    @Prop()
    bankPrefix: string;

    @Prop()
    bankAccount: string;

    @Prop()
    bankPassword: string;

    @Prop({ required: true, default: false })
    active: boolean;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' })
    customer: Customer;
}

export const SiteSchema = SchemaFactory.createForClass(Site);
