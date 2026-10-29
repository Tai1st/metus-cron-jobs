import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseSchema } from './base.schema';

export type ServiceDocument = HydratedDocument<Service>;

@Schema({ timestamps: true })
export class Service extends BaseSchema {
    @Prop()
    name: string;

    @Prop()
    description: string;

    @Prop()
    note: string;

    @Prop()
    details: string;

    @Prop()
    package: string;

    @Prop()
    slug: string;

    @Prop()
    image: string;

    @Prop()
    status: string;

    @Prop({ default: false })
    hasReaction: boolean;

    @Prop({ default: false })
    hasComment: boolean;

    @Prop({ default: true })
    hasQuantity: boolean;
}

export const ServiceSchema = SchemaFactory.createForClass(Service);
