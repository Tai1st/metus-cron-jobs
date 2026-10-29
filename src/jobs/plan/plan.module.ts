import { CustomerPlan, CustomerPlanSchema, Plan, PlanSchema, SubscribedApp, SubscribedAppSchema } from '@/schemas';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlanService } from './plan.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Plan.name, schema: PlanSchema },
            { name: CustomerPlan.name, schema: CustomerPlanSchema },
            { name: SubscribedApp.name, schema: SubscribedAppSchema },
        ]),
        HttpModule,
    ],
    providers: [PlanService],
})
export class PlanModule {}
