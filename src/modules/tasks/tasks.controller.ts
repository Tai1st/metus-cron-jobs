import { CustomerJwtGuard } from '@/auth/customer-jwt.guard';
import { ResponseInterceptor } from '@/common/interceptors/response.interceptor';
import { Body, Controller, Delete, Param, Patch, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TaskDto } from './dto/task.dto';
import { TasksService } from './tasks.service';

@Controller('api/tasks')
@ApiBearerAuth('access-token')
@UseGuards(CustomerJwtGuard)
@UseInterceptors(ResponseInterceptor)
@ApiTags('Tasks')
export class TasksController {
    constructor(private readonly tasksService: TasksService) {}

    @Post()
    addCronJob(@Body() dto: TaskDto, @Req() req) {
        return this.tasksService.addCronJob(dto.postScheduleId, req.user);
    }

    @Patch()
    updateCron(@Body() dto: TaskDto, @Req() req) {
        return this.tasksService.updateCron(dto.postScheduleId, req.user);
    }

    @Delete(':name')
    removeJob(@Param('name') name: string, @Req() req) {
        return this.tasksService.removeJob(name, req.user);
    }
}
