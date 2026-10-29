import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class TaskDto {
    @ApiProperty()
    @IsMongoId()
    postScheduleId: string;
}
