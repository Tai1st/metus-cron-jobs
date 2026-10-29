import {
    Customer,
    CustomerSchema,
    Order,
    OrderSchema,
    Service,
    ServiceSchema,
    ServiceServer,
    ServiceServerSchema,
    SmmPanelPartner,
    SmmPanelPartnerSchema,
} from '@/schemas';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SmmService } from './smm.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: SmmPanelPartner.name, schema: SmmPanelPartnerSchema },
            { name: ServiceServer.name, schema: ServiceServerSchema },
            { name: Service.name, schema: ServiceSchema },
            { name: Order.name, schema: OrderSchema },
            { name: Customer.name, schema: CustomerSchema },
        ]),
        HttpModule,
    ],
    providers: [SmmService],
})
export class SmmModule {}
