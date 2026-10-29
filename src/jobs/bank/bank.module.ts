import {
    AcbTransaction,
    AcbTransactionSchema,
    Action,
    ActionSchema,
    Customer,
    CustomerSchema,
    Setting,
    SettingSchema,
    Site,
    SiteSchema,
    Transaction,
    transactionSchema,
} from '@/schemas';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AcbDirectBankJob } from './acb-direct-bank.job';
import { DepositLedgerService } from './deposit-ledger.service';
import { DepositService } from './deposit.service';
import { Web2mBankJob } from './web2m-bank.job';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: AcbTransaction.name, schema: AcbTransactionSchema },
            { name: Customer.name, schema: CustomerSchema },
            { name: Action.name, schema: ActionSchema },
            { name: Setting.name, schema: SettingSchema },
            { name: Transaction.name, schema: transactionSchema },
            { name: Site.name, schema: SiteSchema },
        ]),
        HttpModule,
    ],
    providers: [DepositLedgerService, DepositService, Web2mBankJob, AcbDirectBankJob],
})
export class BankModule {}
