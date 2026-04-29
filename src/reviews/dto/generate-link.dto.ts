import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateLinkDto {
  @ApiProperty({ example: 42 })
  @IsInt()
  @Min(1)
  appointmentId: number;
}
