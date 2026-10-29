import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseSchema } from './base.schema';

export type PlanDocument = HydratedDocument<Plan>;

@Schema({ timestamps: true })
export class Plan extends BaseSchema {
    @Prop()
    name: string;

    @Prop()
    description: string;

    @Prop()
    price: number;

    @Prop()
    daysUse: number;

    @Prop()
    numAccount: number;

    @Prop()
    numPoster: number;

    @Prop()
    numPage: number;

    @Prop()
    removePost: boolean;

    @Prop()
    customRightCard: boolean;
}

export const PlanSchema = SchemaFactory.createForClass(Plan);
