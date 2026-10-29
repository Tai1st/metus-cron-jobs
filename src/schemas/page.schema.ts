import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { BaseSchema } from './base.schema';
import { Customer } from './customer.schema';
import { FacebookAccount } from './facebook-account.schema';

export type PageDocument = HydratedDocument<Page>;

@Schema({ timestamps: true })
export class Page extends BaseSchema {
    @Prop({ required: true })
    pageId: string;

    @Prop({ required: true })
    name: string;

    @Prop({ required: true })
    accessToken: string;

    @Prop({ required: true })
    isPublished: boolean;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'FacebookAccount' })
    facebookAccount: FacebookAccount;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' })
    customer: Customer;

    @Prop({
        required: false,
        type: mongoose.Schema.Types.Mixed,
    })
    picture: {
        height: number;
        is_silhouette: boolean;
        url: string;
        width: number;
    };
}

export const PageSchema = SchemaFactory.createForClass(Page);
