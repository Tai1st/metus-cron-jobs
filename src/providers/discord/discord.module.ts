import { Global, Module } from '@nestjs/common';
import { DiscordProvider } from './discord.provider';
import { DiscordUpdate } from './discord.update';

@Global()
@Module({
    providers: [DiscordProvider, DiscordUpdate],
    exports: [DiscordProvider],
})
export class DiscordModule {}
