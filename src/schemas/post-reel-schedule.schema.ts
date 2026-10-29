import { PostReelStatus } from '@/enums/facebook';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { BaseSchema } from './base.schema';
import { Customer } from './customer.schema';
import { Page } from './page.schema';

export type PostReelScheduleDocument = HydratedDocument<PostReelSchedule>;

@Schema({ timestamps: true })
export class PostReelSchedule extends BaseSchema {
    @Prop({ required: true })
    videoId: string;

    @Prop({ required: true })
    status: PostReelStatus;

    @Prop({ required: true })
    thumbnail: string;

    @Prop({ required: true })
    calendar: Date;

    @Prop({ required: false })
    description?: string;

    @Prop({ required: false })
    postId?: string;

    @Prop({ required: false })
    reason?: string;

    @Prop({ required: false, type: mongoose.Schema.Types.Mixed })
    videoInfo?: {
        video_status: string;
        uploading_phase: {
            status: string;
        };
        processing_phase: {
            status: string;
            errors: [
                {
                    code: number;
                    message: string;
                },
            ];
        };
        publishing_phase: {
            status: string;
        };
    };

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Page' })
    page: Page;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' })
    customer: Customer;
}

export const PostReelScheduleSchema = SchemaFactory.createForClass(PostReelSchedule);
