import { CustomerJwtGuard } from '@/auth/customer-jwt.guard';
import { ResponseInterceptor } from '@/common/interceptors/response.interceptor';
import { Body, Controller, Delete, Param, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReelDto } from './dto/reel.dto';
import { ReelsService } from './reels.service';

@Controller('api/reels')
@ApiBearerAuth('access-token')
@UseGuards(CustomerJwtGuard)
@UseInterceptors(ResponseInterceptor)
@ApiTags('Reels')
export class ReelsController {
    constructor(private readonly reelsService: ReelsService) {}

    @Post()
    addCronJob(@Body() dto: ReelDto, @Req() req) {
        return this.reelsService.addCronJob(dto.id, req.user);
    }

    @Delete(':videoId')
    removeJob(@Param('videoId') videoId: string, @Req() req) {
        return this.reelsService.removeJob(videoId, req.user);
    }
}
