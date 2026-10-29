import { delay } from '@/common/utils';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

type Channel = 'GENERAL' | 'TRANSACTION' | 'SMM' | 'ERROR';

// Cùng một nội dung gửi lại trong khoảng này sẽ bị bỏ qua, tránh spam khi lỗi lặp mỗi 5-10s.
const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;
// Telegram giới hạn khoảng 1 tin/giây cho mỗi chat và 4096 ký tự cho mỗi tin.
const MIN_INTERVAL_MS = 1000;
const MAX_MESSAGE_LENGTH = 4096;
const MAX_QUEUE_SIZE = 200;
const MAX_ATTEMPTS = 3;

interface QueuedMessage {
    chatId: string;
    threadId?: string;
    text: string;
}

/**
 * Gửi thông báo qua bot Telegram. Tin được xếp hàng và gửi lần lượt, nên gọi `sendTo*` không làm chậm job
 * và không bao giờ ném lỗi: thông báo hỏng không được làm hỏng job nghiệp vụ.
 */
@Injectable()
export class TelegramProvider {
    private readonly logger = new Logger(TelegramProvider.name);
    private readonly recent = new Map<string, number>();
    private readonly queue: QueuedMessage[] = [];
    private draining = false;

    constructor(
        private readonly http: HttpService,
        private readonly config: ConfigService,
    ) {}

    sendToGeneral(message: string): Promise<void> {
        return this.enqueue('GENERAL', message);
    }

    sendToTransaction(message: string): Promise<void> {
        return this.enqueue('TRANSACTION', message);
    }

    sendToSMM(message: string): Promise<void> {
        return this.enqueue('SMM', message);
    }

    sendToError(message: string): Promise<void> {
        return this.enqueue('ERROR', message);
    }

    private async enqueue(channel: Channel, message: string): Promise<void> {
        const chatId = this.config.get<string>(`TELEGRAM_CHAT_${channel}`);
        if (!chatId) {
            this.logger.warn(`TELEGRAM_CHAT_${channel} chưa được cấu hình, bỏ qua thông báo: ${message}`);
            return;
        }
        const threadId = this.config.get<string>(`TELEGRAM_THREAD_${channel}`) || undefined;
        if (this.isDuplicate(`${chatId}:${threadId ?? ''}:${message}`)) {
            return;
        }
        if (this.queue.length >= MAX_QUEUE_SIZE) {
            this.logger.error(`Hàng đợi Telegram đầy (${MAX_QUEUE_SIZE}), bỏ tin: ${message.slice(0, 100)}`);
            return;
        }
        this.queue.push({ chatId, threadId, text: message.slice(0, MAX_MESSAGE_LENGTH) });
        void this.drain();
    }

    /** Gửi lần lượt từng tin trong hàng đợi, cách nhau ít nhất MIN_INTERVAL_MS. */
    private async drain(): Promise<void> {
        if (this.draining) {
            return;
        }
        this.draining = true;
        try {
            let next: QueuedMessage | undefined;
            while ((next = this.queue.shift())) {
                await this.deliver(next);
                await delay(MIN_INTERVAL_MS);
            }
        } finally {
            this.draining = false;
        }
    }

    private async deliver({ chatId, threadId, text }: QueuedMessage): Promise<void> {
        const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                await firstValueFrom(
                    this.http.post(`https://api.telegram.org/bot${token}/sendMessage`, {
                        chat_id: chatId,
                        text,
                        disable_web_page_preview: true,
                        ...(threadId ? { message_thread_id: Number(threadId) } : {}),
                    }),
                );
                return;
            } catch (error) {
                const data = error?.response?.data;
                // Bị giới hạn tốc độ: chờ đúng thời gian Telegram yêu cầu rồi gửi lại.
                if (error?.response?.status === 429 && attempt < MAX_ATTEMPTS) {
                    await delay((Number(data?.parameters?.retry_after) || 1) * 1000);
                    continue;
                }
                // Không in URL/token: chỉ ghi mô tả lỗi của Telegram.
                this.logger.error(`Gửi Telegram thất bại (chat ${chatId}): ${data?.description ?? error?.message}`);
                return;
            }
        }
    }

    private isDuplicate(key: string): boolean {
        const now = Date.now();
        for (const [k, at] of this.recent) {
            if (now - at > DUPLICATE_WINDOW_MS) {
                this.recent.delete(k);
            }
        }
        if (this.recent.has(key)) {
            return true;
        }
        this.recent.set(key, now);
        return false;
    }
}
