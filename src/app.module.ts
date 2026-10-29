import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { validateEnv } from './config/env';
import { BankModule } from './jobs/bank/bank.module';
import { PlanModule } from './jobs/plan/plan.module';
import { SmmModule } from './jobs/smm/smm.module';
import { UsdtModule } from './jobs/usdt/usdt.module';
import { ReelsModule } from './modules/reels/reels.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { TelegramModule } from './providers/telegram/telegram.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        MongooseModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                uri: config.getOrThrow<string>('DATABASE_URI'),
                dbName: config.getOrThrow<string>('DATABASE_NAME'),
                autoIndex: true,
            }),
        }),
        HttpModule.register({ timeout: 10000, maxRedirects: 5 }),
        ScheduleModule.forRoot(),
        TelegramModule,
        BankModule,
        UsdtModule,
        SmmModule,
        PlanModule,
        TasksModule,
        ReelsModule,
    ],
})
export class AppModule {}
