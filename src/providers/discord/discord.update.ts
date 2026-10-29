import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'discord.js';
import { Context, ContextOf, On, Once } from 'necord';

@Injectable()
export class DiscordUpdate {
    private readonly logger = new Logger(DiscordUpdate.name);

    constructor(private readonly client: Client) {}

    @Once('ready')
    onReady(@Context() [client]: ContextOf<'ready'>): void {
        this.logger.log(`Discord bot logged in as ${client.user.username}`);
    }

    @On('warn')
    onWarn(@Context() [message]: ContextOf<'warn'>): void {
        this.logger.warn(message);
    }
}
