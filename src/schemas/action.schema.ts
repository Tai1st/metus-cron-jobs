import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { BaseSchema } from './base.schema';
import { Customer } from './customer.schema';
import { CustomerActivity } from '@/enums/common.enum';

export type ActionDocument = HydratedDocument<Action>;

@Schema({ timestamps: true })
export class Action extends BaseSchema {
    @Prop({
        required: true,
    })
    activity: CustomerActivity;

    @Prop({ required: true })
    ip: string;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' })
    customer: Customer;
}

export const ActionSchema = SchemaFactory.createForClass(Action);
