import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { BaseSchema } from './base.schema';
import { Customer } from './customer.schema';

export type SubscribedAppDocument = HydratedDocument<SubscribedApp>;

@Schema({ timestamps: true })
export class SubscribedApp extends BaseSchema {
    @Prop({ required: true })
    pageId: string;

    @Prop({ required: true })
    name: string;

    @Prop({ required: true })
    pageAccessToken: string;

    @Prop({ required: true, default: true })
    status: boolean;

    @Prop({ required: true })
    picture: mongoose.Schema.Types.Mixed;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' })
    customer: Customer;

    @Prop({
        required: true,
        type: mongoose.Schema.Types.Mixed,
        default: {
            isAutoLike: false,
            isReplyLevelOne: true,
            isHiddenAllComment: false,
            isReplyFirstTime: false,
            content:
                '{{user_full_name}} [Èo ơi iuu thế ..❣️|Đánh Giá p.a.g.e giúp Tớ nhé ..❣| Cho 5k mua kem đi..️❣️ | Làm Ny tớ nhé ..❣️ | iu quá cơ❣️]',
        },
    })
    settings: {
        isAutoLike: boolean;
        isReplyLevelOne: boolean;
        isHiddenAllComment: boolean;
        isReplyFirstTime: boolean;
        content: string;
    };
}

export const SubscribedAppSchema = SchemaFactory.createForClass(SubscribedApp);
