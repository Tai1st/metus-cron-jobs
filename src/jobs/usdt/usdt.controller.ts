import { CustomerJwtGuard } from '@/auth/customer-jwt.guard';
import { ResponseInterceptor } from '@/common/interceptors/response.interceptor';
import { Controller, Get, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsdtInfoService } from './usdt-info.service';

@Controller('api/usdt')
@ApiBearerAuth('access-token')
@UseGuards(CustomerJwtGuard)
@UseInterceptors(ResponseInterceptor)
@ApiTags('USDT')
export class UsdtController {
    constructor(private readonly infoService: UsdtInfoService) {}

    /** Thông tin nạp USDT cho màn hình nạp tiền của FE. */
    @Get('info')
    getInfo(@Req() req) {
        return this.infoService.getInfo(req.user);
    }
}
