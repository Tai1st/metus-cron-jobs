import { POST_SCHEDULE_STATUS } from '@/enums/facebook';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { BaseSchema } from './base.schema';
import { Customer } from './customer.schema';
import { Page } from './page.schema';

export type PostScheduleDocument = HydratedDocument<PostSchedule>;

@Schema({ timestamps: true })
export class PostSchedule extends BaseSchema {
    @Prop({ required: true })
    effectiveObjectStoryId: string;

    @Prop()
    accessToken: string;

    @Prop()
    cookie: string;

    @Prop({ required: true })
    status: POST_SCHEDULE_STATUS;

    @Prop({ required: true })
    calendar: Date;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Page' })
    page: Page;

    @Prop({ required: false })
    reason?: string;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' })
    customer: Customer;
}

export const PostScheduleSchema = SchemaFactory.createForClass(PostSchedule);
