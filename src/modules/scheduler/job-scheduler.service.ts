import { getErrorMessage } from '@/common/utils';
import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

/** Hẹn giờ chạy một lần vào thời điểm cụ thể (lưu trong bộ nhớ, được dựng lại khi khởi động). */
@Injectable()
export class JobScheduler {
    private readonly logger = new Logger(JobScheduler.name);

    constructor(private readonly registry: SchedulerRegistry) {}

    /** Hẹn `task` chạy tại `at`. Hẹn lại cùng `name` sẽ thay thế job cũ. */
    schedule(name: string, at: Date, task: () => Promise<void>): void {
        this.cancel(name);
        const job = new CronJob(
            at,
            async () => {
                this.logger.warn(`job ${name} to run!`);
                try {
                    await task();
                } catch (error) {
                    this.logger.error(`job ${name} failed: ${getErrorMessage(error)}`);
                } finally {
                    this.cancel(name);
                }
            },
            null,
            false,
            'Asia/Ho_Chi_Minh',
        );
        this.registry.addCronJob(name, job);
        job.start();
        this.logger.warn(`job ${name} added at ${at.toISOString()}`);
    }

    /** Huỷ job nếu còn tồn tại. Trả về false nếu không có job nào (đã chạy xong hoặc chưa từng hẹn). */
    cancel(name: string): boolean {
        if (!this.registry.doesExist('cron', name)) {
            return false;
        }
        this.registry.deleteCronJob(name);
        this.logger.warn(`job ${name} deleted!`);
        return true;
    }
}
