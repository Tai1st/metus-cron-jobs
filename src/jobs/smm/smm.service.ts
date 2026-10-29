import { USD_RATE } from '@/common/constants';
import { customRound, envFlag, getErrorMessage, SingleFlight } from '@/common/utils';
import { OrderStatus } from '@/enums/order.enum';
import { TelegramProvider } from '@/providers/telegram/telegram.provider';
import {
    Customer,
    CustomerDocument,
    Order,
    OrderDocument,
    ServiceServer,
    ServiceServerDocument,
    ServiceServerStatus,
    SmmPanelPartner,
    SmmPanelPartnerCurrency,
    SmmPanelPartnerDocument,
    SmmPanelPartnerStatus,
} from '@/schemas';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';

const FORM_HEADERS = { 'Content-Type': 'application/x-www-form-urlencoded' };
const PRICE_EPSILON = 1e-9;

// Trạng thái đơn của panel SMM -> trạng thái đơn của Metus (không gồm 'Canceled', xử lý riêng vì liên quan hoàn tiền).
const STATUS_MAP: Record<string, OrderStatus> = {
    Pending: OrderStatus.PENDING,
    'In progress': OrderStatus.IN_PROGRESS,
    Processing: OrderStatus.PROCESSING,
    Completed: OrderStatus.SUCCESS,
    Partial: OrderStatus.PARTIAL,
};

@Injectable()
export class SmmService {
    private readonly logger = new Logger(SmmService.name);
    private readonly priceFlight = new SingleFlight();
    private readonly orderFlight = new SingleFlight();

    constructor(
        private readonly http: HttpService,
        private readonly telegram: TelegramProvider,
        @InjectModel(SmmPanelPartner.name) private readonly partnerModel: Model<SmmPanelPartnerDocument>,
        @InjectModel(ServiceServer.name) private readonly serverModel: Model<ServiceServerDocument>,
        @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
        @InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>,
    ) {}

    // ---------------------------------------------------------------- Giá

    @Cron('*/5 * * * * *')
    async checkPrice(): Promise<void> {
        if (!envFlag('JOB_CHECK_PRICE_ENABLE', true)) {
            return;
        }
        await this.priceFlight.run(async () => {
            const partners = await this.partnerModel.find({ status: SmmPanelPartnerStatus.ACTIVE });
            await Promise.all(partners.map((partner) => this.syncPartnerPrices(partner)));
        });
    }

    private async syncPartnerPrices(partner: SmmPanelPartnerDocument): Promise<void> {
        try {
            const data = await this.callPanel(partner, { action: 'services' });
            // Chỉ tin dữ liệu khi panel trả về danh sách; nếu không thì KHÔNG đụng tới server nào.
            if (!Array.isArray(data)) {
                await this.telegram.sendToError(
                    `🚱 Lỗi check giá smm: [${partner.name}] ${partner.link} ${JSON.stringify(data)}`,
                );
                return;
            }

            const services = new Map<string, AnyObject>(data.map((service) => [String(service.service), service]));
            const servers = await this.serverModel.find({
                smmPanelPartner: partner.id,
                status: ServiceServerStatus.ACTIVE,
            });

            const operations = [];
            for (const server of servers) {
                const service = services.get(String(server.smmServer));
                if (!service) {
                    const message = `🚱 [${server.id}] Không tìm thấy service ${server.smmServer} trong dữ liệu trả về từ smm panel [${partner.name}] Link: ${partner.link}`;
                    this.logger.error(message);
                    await this.telegram.sendToError(message);
                    operations.push({
                        updateOne: {
                            filter: { _id: server._id },
                            update: { $set: { status: ServiceServerStatus.INACTIVE } },
                        },
                    });
                    continue;
                }

                let rate = Number(service.rate);
                if (partner.currency === SmmPanelPartnerCurrency.USD) {
                    rate = (rate * USD_RATE) / 1000;
                }
                const price = customRound(rate + rate * server.percentPrice);

                if (Math.abs((server.smmPrice ?? 0) - rate) > PRICE_EPSILON) {
                    const message = `⚠️ Có thay đổi về giá [${partner.name}] Link: ${partner.link}. \n- Giá smm cũ: ${server.smmPrice} \n- Giá smm mới: ${rate} \n- smmServer: ${server.smmServer} \n- Giá bán mới: ${price} \n- Server: ${server.serverNumber} \n- Name: ${server.name}`;
                    this.logger.debug(message);
                    await this.telegram.sendToSMM(message);
                }

                operations.push({
                    updateOne: {
                        filter: { _id: server._id },
                        update: { $set: { price, min: Number(service.min), max: Number(service.max), smmPrice: rate } },
                    },
                });
            }

            if (operations.length) {
                await this.serverModel.bulkWrite(operations);
            }
        } catch (error) {
            this.logger.error(`[${partner.name}] Lỗi khi lấy dữ liệu từ smm panel: ${getErrorMessage(error)}`);
            await this.telegram.sendToError(
                `🚱 Lỗi check giá smm::: [${partner.name}] ${partner.link} ${getErrorMessage(error)}`,
            );
        }
    }

    // ---------------------------------------------------------------- Đơn hàng

    @Cron('*/10 * * * * *')
    async checkOrder(): Promise<void> {
        if (!envFlag('JOB_CHECK_SMM_ORDER', true)) {
            return;
        }
        await this.orderFlight.run(async () => {
            const orders = await this.orderModel
                .find({ status: { $in: [OrderStatus.PROCESSING, OrderStatus.PENDING, OrderStatus.IN_PROGRESS] } })
                .populate({ path: 'server', populate: { path: 'smmPanelPartner' } })
                .populate('service customer');

            const byPartner = new Map<string, { partner: SmmPanelPartnerDocument; orders: OrderDocument[] }>();
            for (const order of orders) {
                const partner = order.server?.smmPanelPartner;
                if (!partner || !order.smmOrderId) {
                    this.logger.error(`Không tìm thấy smmPanelPartner hoặc smmOrderId cho order ${order.id}`);
                    continue;
                }
                const group = byPartner.get(partner.id) ?? { partner, orders: [] };
                group.orders.push(order);
                byPartner.set(partner.id, group);
            }

            for (const { partner, orders: partnerOrders } of byPartner.values()) {
                await this.syncPartnerOrders(partner, partnerOrders);
            }
        });
    }

    private async syncPartnerOrders(partner: SmmPanelPartnerDocument, orders: OrderDocument[]): Promise<void> {
        try {
            const statuses = await this.callPanel(partner, {
                action: 'status',
                orders: orders.map((order) => order.smmOrderId).join(','),
            });

            const canceled: OrderDocument[] = [];
            for (const order of orders) {
                try {
                    const info = statuses?.[order.smmOrderId];
                    if (!info || info.error) {
                        continue;
                    }
                    const progress = {
                        startCount: info.start_count,
                        completedCount: order.quantity - Number(info.remains),
                    };

                    if (info.status === 'Canceled') {
                        // Chưa lưu ngay: cần quyết định hoàn tiền trước khi chuyển sang CANCEL.
                        order.set(progress);
                        canceled.push(order);
                    } else if (STATUS_MAP[info.status]) {
                        await this.orderModel.updateOne(
                            { _id: order._id },
                            { $set: { ...progress, status: STATUS_MAP[info.status] } },
                        );
                    }
                } catch (error) {
                    this.logger.error(`[${partner.name}] Check order ${order.id} error: ${getErrorMessage(error)}`);
                }
            }

            if (canceled.length) {
                await this.handleCanceledOrders(partner, canceled);
            }
        } catch (error) {
            this.logger.error(`[${partner.name}] Check order error: ${getErrorMessage(error)}`);
        }
    }

    /**
     * Đơn bị panel hủy: hoàn tiền cho khách khi số dư panel tăng lên (panel đã hoàn tiền cho Metus).
     * Lấy số dư panel MỘT lần cho cả lượt, để nhiều đơn hủy cùng lúc đều được xét hoàn tiền.
     * Nếu không lấy được số dư thì giữ nguyên đơn, lượt sau thử lại (không mất cơ hội hoàn tiền).
     */
    private async handleCanceledOrders(partner: SmmPanelPartnerDocument, canceled: OrderDocument[]): Promise<void> {
        const oldBalance = partner.balance;
        let newBalance: number;
        try {
            const data = await this.callPanel(partner, { action: 'balance' });
            newBalance = Number(data?.balance);
            if (!Number.isFinite(newBalance)) {
                throw new Error(`Số dư không hợp lệ: ${JSON.stringify(data)}`);
            }
        } catch (error) {
            this.logger.error(`[${partner.name}] Check balance error: ${getErrorMessage(error)}`);
            return;
        }

        await this.partnerModel.updateOne({ _id: partner._id }, { $set: { balance: newBalance } });
        partner.balance = newBalance;
        const refundable = newBalance > oldBalance;

        for (const order of canceled) {
            try {
                const customer = order.customer;
                await this.telegram.sendToSMM(
                    `⚠️ Đơn hàng ${order.id} đã bị hủy \nPartner: ${partner.link} \nsmmOrderId: ${order.smmOrderId} \nService: ${order.service?.name} \nsmmServer: ${order.server?.smmServer} \nLink: ${order.link} \nSố lượng: ${order.quantity} \nGiá: ${order.price} \nTổng thanh toán: ${order.totalPayment} \nEmail: ${customer?.email} \nSố dư cũ: ${customer?.balance} \n- smmSố dư cũ: ${oldBalance} \n- smmSố dư mới: ${newBalance}`,
                );

                const update = {
                    startCount: order.startCount,
                    completedCount: order.completedCount,
                    status: OrderStatus.CANCEL,
                };

                if (!refundable) {
                    await this.orderModel.updateOne({ _id: order._id }, { $set: update });
                    await this.telegram.sendToSMM(
                        `🚨 Đơn ${order.id} bị hủy nhưng số dư panel không tăng, CHƯA hoàn ${order.totalPayment}đ cho ${customer?.email}. Cần kiểm tra và hoàn tay nếu hợp lệ.`,
                    );
                    continue;
                }

                // Giành quyền hoàn tiền bằng cập nhật atomic: đơn chỉ được hoàn đúng một lần.
                const claimed = await this.orderModel.findOneAndUpdate(
                    { _id: order._id, refunded: { $ne: true } },
                    { $set: { ...update, refunded: true } },
                );
                if (!claimed) {
                    this.logger.error(`Đơn hàng ${order.id} đã được hoàn tiền`);
                    continue;
                }
                const before = await this.customerModel.findByIdAndUpdate(customer._id, {
                    $inc: { balance: order.totalPayment },
                });
                await this.telegram.sendToSMM(
                    `⚠️ Đã hoàn ${order.totalPayment}đ cho ${customer.email} do đơn hàng ${order.id} bị hủy \n- Số dư cũ: ${before?.balance} \n- Số dư mới: ${(before?.balance ?? 0) + order.totalPayment}`,
                );
            } catch (error) {
                this.logger.error(`[${partner.name}] Xử lý đơn hủy ${order.id} lỗi: ${getErrorMessage(error)}`);
                await this.telegram.sendToError(`🚨 Lỗi khi xử lý đơn hủy ${order.id}: ${getErrorMessage(error)}`);
            }
        }
    }

    private async callPanel(partner: SmmPanelPartnerDocument, payload: AnyObject): Promise<any> {
        const { data } = await firstValueFrom(
            this.http.post(partner.link, { ...payload, key: partner.token }, { headers: FORM_HEADERS }),
        );
        return data;
    }
}
