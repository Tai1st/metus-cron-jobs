import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { BaseSchema } from './base.schema';
import { Customer } from './customer.schema';

export type FacebookAccountDocument = HydratedDocument<FacebookAccount>;

@Schema({ timestamps: true })
export class FacebookAccount extends BaseSchema {
    @Prop({ required: true })
    uid: string;

    @Prop({ required: true })
    accessToken: string;

    @Prop()
    cookie: string;

    @Prop({ lowercase: true })
    email?: string;

    @Prop({ required: true })
    name: string;

    @Prop()
    avatar: string;

    // @Prop({ required: true })
    // type: FacebookAccountType;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' })
    customer: Customer;
}

export const FacebookAccountSchema = SchemaFactory.createForClass(FacebookAccount);
