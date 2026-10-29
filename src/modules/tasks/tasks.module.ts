import { AuthModule } from '@/auth/auth.module';
import { FacebookModule } from '@/modules/facebook/facebook.module';
import { JobSchedulerModule } from '@/modules/scheduler/scheduler.module';
import { Page, PageSchema, PostSchedule, PostScheduleSchema } from '@/schemas';
import { FacebookAccount, FacebookAccountSchema } from '@/schemas/facebook-account.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: PostSchedule.name, schema: PostScheduleSchema },
            // Cần đăng ký để populate page -> facebookAccount.
            { name: Page.name, schema: PageSchema },
            { name: FacebookAccount.name, schema: FacebookAccountSchema },
        ]),
        AuthModule,
        FacebookModule,
        JobSchedulerModule,
    ],
    controllers: [TasksController],
    providers: [TasksService],
})
export class TasksModule {}
