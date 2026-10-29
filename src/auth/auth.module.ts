import { Customer, CustomerSchema } from '@/schemas';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { CustomerJwtGuard } from './customer-jwt.guard';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Customer.name, schema: CustomerSchema }]),
        JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({ secret: config.getOrThrow<string>('JWT_CLIENT_SECRET_KEY') }),
        }),
    ],
    providers: [CustomerJwtGuard],
    exports: [CustomerJwtGuard, JwtModule, MongooseModule],
})
export class AuthModule {}
