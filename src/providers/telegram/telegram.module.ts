import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { TelegramProvider } from './telegram.provider';

@Global()
@Module({
    imports: [HttpModule.register({ timeout: 10000 })],
    providers: [TelegramProvider],
    exports: [TelegramProvider],
})
export class TelegramModule {}
