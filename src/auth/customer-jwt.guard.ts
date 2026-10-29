import { Customer, CustomerDocument } from '@/schemas';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Request } from 'express';
import { Model } from 'mongoose';

interface JwtPayload {
    id: string;
}

/** Xác thực JWT của khách hàng và gắn customer đang active vào request.user. */
@Injectable()
export class CustomerJwtGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        @InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request & { user?: CustomerDocument }>();
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        if (type !== 'Bearer' || !token) {
            throw new UnauthorizedException();
        }

        let payload: JwtPayload;
        try {
            payload = await this.jwtService.verifyAsync<JwtPayload>(token);
        } catch {
            throw new UnauthorizedException();
        }

        const customer = await this.customerModel.findOne({ _id: payload.id, active: true });
        if (!customer) {
            throw new UnauthorizedException();
        }
        request.user = customer;
        return true;
    }
}
