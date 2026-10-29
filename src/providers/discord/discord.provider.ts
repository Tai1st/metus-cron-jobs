import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, TextChannel } from 'discord.js';

// Cùng một nội dung gửi lại trong khoảng này sẽ bị bỏ qua, tránh spam @everyone khi lỗi lặp mỗi 5-10s.
const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

@Injectable()
export class DiscordProvider {
    private readonly logger = new Logger(DiscordProvider.name);
    private readonly recent = new Map<string, number>();

    constructor(
        private readonly client: Client,
        private readonly config: ConfigService,
    ) {}

    sendToGeneral(message: string): Promise<void> {
        return this.send('DISCORD_CHANNEL_GENERAL', message);
    }

    sendToTransaction(message: string): Promise<void> {
        return this.send('DISCORD_CHANNEL_TRANSACTION', message);
    }

    sendToSMM(message: string): Promise<void> {
        return this.send('DISCORD_CHANNEL_SMM', message);
    }

    sendToError(message: string): Promise<void> {
        return this.send('DISCORD_CHANNEL_ERROR', message);
    }

    /** Không bao giờ ném lỗi: thông báo Discord hỏng không được làm hỏng job nghiệp vụ. */
    private async send(channelKey: string, message: string): Promise<void> {
        const channelId = this.config.get<string>(channelKey);
        if (!channelId) {
            this.logger.warn(`${channelKey} chưa được cấu hình, bỏ qua thông báo: ${message}`);
            return;
        }
        if (this.isDuplicate(`${channelId}:${message}`)) {
            return;
        }
        try {
            const channel = await this.client.channels.fetch(channelId);
            if (!channel || !channel.isTextBased()) {
                throw new Error('Không tìm thấy channel hoặc không phải channel dạng text.');
            }
            await (channel as TextChannel).send({
                content: `@everyone\n${message}`.slice(0, 2000),
                allowedMentions: { parse: ['everyone'] },
            });
        } catch (error) {
            this.logger.error(`Gửi Discord (${channelKey}) thất bại: ${error.message}`);
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
