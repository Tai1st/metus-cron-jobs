import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { BaseSchema } from './base.schema';
import { Customer } from './customer.schema';

export type PostDocument = HydratedDocument<Post>;

@Schema({ timestamps: true })
export class Post extends BaseSchema {
    @Prop({ required: true })
    effectiveObjectStoryId: string;

    @Prop({ required: true })
    status: string;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' })
    customer: Customer;
}

export const PostSchema = SchemaFactory.createForClass(Post);
