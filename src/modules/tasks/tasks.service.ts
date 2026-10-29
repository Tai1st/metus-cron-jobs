import { getErrorMessage } from '@/common/utils';
import { POST_SCHEDULE_STATUS } from '@/enums/facebook';
import { JobScheduler } from '@/modules/scheduler/job-scheduler.service';
import { FacebookService } from '@/modules/facebook/facebook.service';
import { CustomerDocument, PostSchedule, PostScheduleDocument } from '@/schemas';
import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isBefore } from 'date-fns';
import { Model } from 'mongoose';

const JOB_PREFIX = 'POST_';

/** Hẹn giờ đăng bài Facebook (publish bài đã tạo sẵn ở trạng thái chưa công khai). */
@Injectable()
export class TasksService implements OnModuleInit {
    private readonly logger = new Logger(TasksService.name);

    constructor(
        private readonly scheduler: JobScheduler,
        private readonly facebookService: FacebookService,
        @InjectModel(PostSchedule.name) private readonly postScheduleModel: Model<PostSchedule>,
    ) {}

    /** Dựng lại các job hẹn giờ sau khi khởi động lại; bài đã quá giờ thì đăng ngay. */
    async onModuleInit(): Promise<void> {
        const posts = await this.postScheduleModel.find({ status: POST_SCHEDULE_STATUS.WAIT_PUBLISH });
        for (const post of posts) {
            if (isBefore(new Date(post.calendar), new Date())) {
                void this.publish(post.id);
            } else {
                this.schedule(post);
            }
        }
    }

    async addCronJob(postScheduleId: string, customer: CustomerDocument): Promise<void> {
        const post = await this.findOwned(postScheduleId, customer);
        if (isBefore(new Date(post.calendar), new Date())) {
            throw new BadRequestException('Date in too past');
        }
        this.schedule(post);
    }

    /** Hẹn lại giờ đăng sau khi người dùng đổi lịch. */
    async updateCron(postScheduleId: string, customer: CustomerDocument): Promise<void> {
        const post = await this.findOwned(postScheduleId, customer);
        if (isBefore(new Date(post.calendar), new Date())) {
            throw new BadRequestException('Date in too past');
        }
        this.schedule(post); // thay thế job cũ cùng tên
    }

    /** Huỷ job theo effectiveObjectStoryId. Idempotent: job đã chạy xong/không tồn tại vẫn trả thành công. */
    async removeJob(name: string, customer: CustomerDocument): Promise<{ removed: boolean }> {
        const post = await this.postScheduleModel.findOne({ effectiveObjectStoryId: name, customer: customer._id });
        return { removed: post ? this.scheduler.cancel(JOB_PREFIX + name) : false };
    }

    private async findOwned(id: string, customer: CustomerDocument): Promise<PostScheduleDocument> {
        const post = await this.postScheduleModel.findOne({ _id: id, customer: customer._id });
        if (!post) {
            throw new BadRequestException('Post schedule not found');
        }
        return post;
    }

    private schedule(post: PostScheduleDocument): void {
        this.scheduler.schedule(JOB_PREFIX + post.effectiveObjectStoryId, new Date(post.calendar), () =>
            this.publish(post.id),
        );
    }

    /** Đọc lại bài tại thời điểm chạy (không dùng bản chụp cũ lúc hẹn giờ). */
    private async publish(id: string): Promise<void> {
        const post = await this.postScheduleModel
            .findById(id)
            .populate({ path: 'page', populate: { path: 'facebookAccount' } });
        if (!post || post.status === POST_SCHEDULE_STATUS.SUCCESS) {
            return; // đã bị xoá hoặc đã đăng
        }

        this.logger.debug(`Start publishEffectiveObjectStory ${post.effectiveObjectStoryId}`);
        try {
            const page = post.page;
            const accessToken = page ? page.accessToken : post.accessToken;
            const account = page ? page.facebookAccount : { cookie: post.cookie };
            await this.facebookService.publishEffectiveObjectStory(post.effectiveObjectStoryId, accessToken, account);
            post.status = POST_SCHEDULE_STATUS.SUCCESS;
            this.logger.log(`Success publishEffectiveObjectStory ${post.effectiveObjectStoryId}`);
        } catch (error) {
            post.status = POST_SCHEDULE_STATUS.FAILURE;
            post.reason = getErrorMessage(error);
            this.logger.error(`Error publishEffectiveObjectStory ${post.effectiveObjectStoryId}: ${post.reason}`);
        }
        await post.save();
    }
}
