import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class ReelDto {
    @ApiProperty()
    @IsMongoId()
    id: string;
}
