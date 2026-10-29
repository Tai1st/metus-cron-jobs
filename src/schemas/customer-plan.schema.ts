import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { BaseSchema } from './base.schema';
import { Customer } from './customer.schema';
import { Plan } from './plan.schema';

@Schema({ timestamps: true })
export class CustomerPlan extends BaseSchema {
    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' })
    customer: Customer;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Plan' })
    plan: Plan;

    @Prop({ required: true, default: new Date() })
    purchaseDate: Date;

    @Prop({ required: true })
    expirationDate: Date;
}

export const CustomerPlanSchema = SchemaFactory.createForClass(CustomerPlan);
