import { envFlag, getErrorMessage, SingleFlight } from '@/common/utils';
import { DiscordProvider } from '@/providers/discord/discord.provider';
import { CustomerPlan, Plan, SubscribedApp } from '@/schemas';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';

// Mã lỗi Facebook cho biết token/page không còn dùng được: thử lại cũng vô ích nên vẫn đánh dấu đã gỡ.
const FB_PERMANENT_ERROR_CODES = [100, 190];

@Injectable()
export class PlanService {
    private readonly logger = new Logger(PlanService.name);
    private readonly flight = new SingleFlight();

    constructor(
        private readonly discord: DiscordProvider,
        private readonly http: HttpService,
        @InjectModel(Plan.name) private readonly planModel: Model<Plan>,
        @InjectModel(CustomerPlan.name) private readonly customerPlanModel: Model<CustomerPlan>,
        @InjectModel(SubscribedApp.name) private readonly subscribedAppModel: Model<SubscribedApp>,
    ) {}

    /** Mỗi ngày 00:00 (giờ Việt Nam): gỡ đăng ký app Facebook của các gói đã hết hạn. */
    @Cron('0 0 0 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
    async cancelAutoComment(): Promise<void> {
        if (!envFlag('JOB_CANCEL_PLAN_ENABLE', true)) {
            return;
        }
        await this.flight.run(() => this.cancelExpiredPlans());
    }

    private async cancelExpiredPlans(): Promise<void> {
        this.logger.debug('CancelAutoComment starting...');
        try {
            const freePlan = await this.planModel.findOne({ price: 0 });
            if (!freePlan) {
                throw new Error('Không tìm thấy gói miễn phí (price = 0)');
            }
            const expiredPlans = await this.customerPlanModel.find({
                plan: { $ne: freePlan.id },
                expirationDate: { $lt: new Date() },
            });

            for (const customerPlan of expiredPlans) {
                const apps = await this.subscribedAppModel.find({ customer: customerPlan.customer, status: true });
                for (const app of apps) {
                    await this.unsubscribe(app);
                }
            }
        } catch (error) {
            this.logger.error(`CancelAutoComment error: ${getErrorMessage(error)}`);
            await this.discord.sendToError(`[PlanService] CancelAutoComment error: ${getErrorMessage(error)}`);
        }
        this.logger.debug('CancelAutoComment finished');
    }

    private async unsubscribe(app: SubscribedApp & { _id: unknown }): Promise<void> {
        const { pageId, pageAccessToken } = app;
        this.logger.log(`[${pageId}] Start cancel page...`);
        let done = true;
        try {
            await firstValueFrom(
                this.http.delete(`https://graph.facebook.com/${pageId}/subscribed_apps`, {
                    params: { subscribed_fields: 'feed', access_token: pageAccessToken },
                }),
            );
            this.logger.log(`[${pageId}] Cancel page success!`);
        } catch (error) {
            const code = error?.response?.data?.error?.code;
            // Lỗi tạm thời: giữ status=true để ngày mai thử lại, không bỏ sót.
            done = FB_PERMANENT_ERROR_CODES.includes(code);
            this.logger.error(`[${pageId}] Cancel page failure: ${getErrorMessage(error)}`);
            await this.discord.sendToError(`[${pageId}] ${getErrorMessage(error)}`);
        }
        if (done) {
            await this.subscribedAppModel.updateOne({ _id: app._id }, { $set: { status: false } });
        }
    }
}
