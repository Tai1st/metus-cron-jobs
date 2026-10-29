import { Module } from '@nestjs/common';
import { JobScheduler } from './job-scheduler.service';

@Module({
    providers: [JobScheduler],
    exports: [JobScheduler],
})
export class JobSchedulerModule {}
