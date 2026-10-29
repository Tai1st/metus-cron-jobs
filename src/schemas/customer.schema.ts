import { LoginProvider } from '@/enums/common.enum';
import { CustomerPartnerLevel } from '@/enums/customer.enum';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { BaseSchema } from './base.schema';
import { CustomerPlan } from './customer-plan.schema';
import { Plan } from './plan.schema';

export type CustomerDocument = HydratedDocument<Customer>;

@Schema({ timestamps: true })
export class Customer extends BaseSchema {
    @Prop({ required: false })
    name: string;

    @Prop({ lowercase: true })
    email: string;

    @Prop({ select: false })
    password?: string;

    @Prop({ required: true })
    bankCode: string;

    @Prop({ required: true, default: 0 })
    balance: number;

    @Prop({ required: true, default: 0 })
    totalDeposit: number;

    @Prop({ required: false })
    phoneNumber: string;

    @Prop({ default: true })
    active: boolean;

    @Prop({ default: false })
    reasonLock: string;

    @Prop({ default: false })
    isEmailVerified: boolean;

    @Prop({ default: false })
    isPartner: boolean;

    @Prop()
    partnerLevel: CustomerPartnerLevel;

    @Prop({ default: LoginProvider.facebook })
    provider: string;

    @Prop({ default: 'default/avatar.png' })
    avatar?: string;

    @Prop()
    lastLoginAt: Date;

    @Prop()
    lastLoginIp: string;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' })
    ref?: Customer;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Plan' })
    plan?: Plan;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'CustomerPlan' })
    customerPlan?: CustomerPlan;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
