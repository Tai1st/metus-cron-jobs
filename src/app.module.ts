import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { IntentsBitField } from 'discord.js';
import { NecordModule } from 'necord';
import { validateEnv } from './config/env';
import { BankModule } from './jobs/bank/bank.module';
import { PlanModule } from './jobs/plan/plan.module';
import { SmmModule } from './jobs/smm/smm.module';
import { ReelsModule } from './modules/reels/reels.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { DiscordModule } from './providers/discord/discord.module';

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
        NecordModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                token: config.getOrThrow<string>('DISCORD_BOT_TOKEN'),
                intents: [IntentsBitField.Flags.Guilds],
                development: [config.get<string>('DISCORD_DEVELOPMENT_GUILD_ID')].filter(Boolean),
            }),
        }),
        HttpModule.register({ timeout: 10000, maxRedirects: 5 }),
        ScheduleModule.forRoot(),
        DiscordModule,
        BankModule,
        SmmModule,
        PlanModule,
        TasksModule,
        ReelsModule,
    ],
})
export class AppModule {}
