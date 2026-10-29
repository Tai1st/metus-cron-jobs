import { AuthModule } from '@/auth/auth.module';
import { JobSchedulerModule } from '@/modules/scheduler/scheduler.module';
import { Page, PageSchema, PostReelSchedule, PostReelScheduleSchema } from '@/schemas';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReelsController } from './reels.controller';
import { ReelsService } from './reels.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: PostReelSchedule.name, schema: PostReelScheduleSchema },
            // Cần đăng ký để populate page.
            { name: Page.name, schema: PageSchema },
        ]),
        AuthModule,
        HttpModule,
        JobSchedulerModule,
    ],
    controllers: [ReelsController],
    providers: [ReelsService],
})
export class ReelsModule {}
