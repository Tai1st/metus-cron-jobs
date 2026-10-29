import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { BaseSchema } from './base.schema';

export type SettingDocument = HydratedDocument<Setting>;

@Schema({ timestamps: true })
export class Setting extends BaseSchema {
    @Prop({
        required: true,
    })
    key: string;

    @Prop({ required: true, type: mongoose.Schema.Types.Mixed })
    value: AnyObject;
}

export const SettingSchema = SchemaFactory.createForClass(Setting);
