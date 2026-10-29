import { delay, getErrorMessage } from '@/common/utils';
import { PostReelStatus } from '@/enums/facebook';
import { JobScheduler } from '@/modules/scheduler/job-scheduler.service';
import { CustomerDocument, PostReelSchedule, PostReelScheduleDocument } from '@/schemas';
import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isBefore } from 'date-fns';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';

const JOB_PREFIX = 'POST_REELS_';
const GRAPH_URL = 'https://graph.facebook.com/v18.0';

/** Hẹn giờ đăng Reels lên trang Facebook. */
@Injectable()
export class ReelsService implements OnModuleInit {
    private readonly logger = new Logger(ReelsService.name);

    constructor(
        private readonly scheduler: JobScheduler,
        private readonly http: HttpService,
        @InjectModel(PostReelSchedule.name) private readonly reelModel: Model<PostReelSchedule>,
    ) {}

    /**
     * Dựng lại job sau khi khởi động lại. BE đặt trạng thái SCHEDULED khi hẹn giờ.
     * Reel chưa tới giờ -> hẹn lại. Reel WAIT_PUBLISH đã quá giờ -> đăng ngay.
     * Reel SCHEDULED đã quá giờ -> KHÔNG tự đăng (có thể là dữ liệu cũ), chỉ cảnh báo để kiểm tra.
     */
    async onModuleInit(): Promise<void> {
        const reels = await this.reelModel.find({
            status: { $in: [PostReelStatus.WAIT_PUBLISH, PostReelStatus.SCHEDULED] },
        });
        for (const reel of reels) {
            const overdue = isBefore(new Date(reel.calendar), new Date());
            if (!overdue) {
                this.schedule(reel);
            } else if (reel.status === PostReelStatus.WAIT_PUBLISH) {
                void this.publish(reel.id);
            } else {
                this.logger.warn(`Reel ${reel.videoId} (SCHEDULED) đã quá giờ ${reel.calendar}, bỏ qua.`);
            }
        }
    }

    async addCronJob(id: string, customer: CustomerDocument): Promise<void> {
        const reel = await this.findOwned({ _id: id }, customer);
        if (isBefore(new Date(reel.calendar), new Date())) {
            throw new BadRequestException('Date in too past');
        }
        this.schedule(reel); // hẹn lại cùng videoId sẽ thay thế job cũ
    }

    /** Huỷ job theo videoId. Idempotent: job đã chạy xong/không tồn tại vẫn trả thành công. */
    async removeJob(videoId: string, customer: CustomerDocument): Promise<{ removed: boolean }> {
        const reel = await this.reelModel.findOne({ videoId, customer: customer._id });
        return { removed: reel ? this.scheduler.cancel(JOB_PREFIX + videoId) : false };
    }

    private async findOwned(filter: AnyObject, customer: CustomerDocument): Promise<PostReelScheduleDocument> {
        const reel = await this.reelModel.findOne({ ...filter, customer: customer._id });
        if (!reel) {
            throw new BadRequestException('Post reels schedule not found');
        }
        return reel;
    }

    private schedule(reel: PostReelScheduleDocument): void {
        this.scheduler.schedule(JOB_PREFIX + reel.videoId, new Date(reel.calendar), () => this.publish(reel.id));
    }

    /** Đọc lại reel tại thời điểm chạy rồi đăng và theo dõi trạng thái xử lý video. */
    private async publish(id: string): Promise<void> {
        const reel = await this.reelModel.findById(id).populate('page');
        if (!reel || reel.status === PostReelStatus.SUCCESS) {
            return;
        }

        try {
            const { page } = reel;
            const { data: finish } = await firstValueFrom(
                this.http.post(`${GRAPH_URL}/${page.pageId}/video_reels`, null, {
                    params: {
                        access_token: page.accessToken,
                        video_id: reel.videoId,
                        upload_phase: 'finish',
                        video_state: 'PUBLISHED',
                        description: reel.description,
                    },
                }),
            );
            reel.postId = finish.post_id;

            await delay(5000);
            for (let i = 0; i < 20; i++) {
                const { data } = await firstValueFrom(
                    this.http.get(`${GRAPH_URL}/${reel.videoId}`, {
                        params: { access_token: page.accessToken, fields: 'status' },
                    }),
                );
                reel.videoInfo = data.status;
                const videoStatus = data?.status?.video_status;
                if (videoStatus === 'processing') {
                    reel.status = PostReelStatus.PROCESSING;
                    await delay(3000);
                    continue;
                }
                if (videoStatus === 'error') {
                    reel.status = PostReelStatus.FAILURE;
                } else if (videoStatus === 'ready') {
                    reel.status = PostReelStatus.SUCCESS;
                }
                break;
            }
        } catch (error) {
            reel.status = PostReelStatus.FAILURE;
            reel.reason = getErrorMessage(error) || 'Có lỗi xảy ra';
            this.logger.error(`Publish reel ${reel.videoId} failed: ${reel.reason}`);
        }
        await reel.save();
    }
}
