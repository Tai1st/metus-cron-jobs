import { AuthModule } from '@/auth/auth.module';
import {
    Action,
    ActionSchema,
    Customer,
    CustomerSchema,
    Setting,
    SettingSchema,
    Transaction,
    transactionSchema,
    UsdtTransaction,
    UsdtTransactionSchema,
} from '@/schemas';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BinanceClient } from './binance.client';
import { UsdtCreditService } from './usdt-credit.service';
import { UsdtCustomerIndex } from './usdt-customer-index.service';
import { UsdtDepositJob } from './usdt-deposit.job';
import { UsdtInfoService } from './usdt-info.service';
import { UsdtSettingsService } from './usdt-settings.service';
import { UsdtController } from './usdt.controller';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: UsdtTransaction.name, schema: UsdtTransactionSchema },
            { name: Customer.name, schema: CustomerSchema },
            { name: Action.name, schema: ActionSchema },
            { name: Setting.name, schema: SettingSchema },
            { name: Transaction.name, schema: transactionSchema },
        ]),
        AuthModule,
        HttpModule.register({ timeout: 10000 }),
    ],
    controllers: [UsdtController],
    providers: [
        BinanceClient,
        UsdtSettingsService,
        UsdtCustomerIndex,
        UsdtCreditService,
        UsdtInfoService,
        UsdtDepositJob,
    ],
})
export class UsdtModule {}
