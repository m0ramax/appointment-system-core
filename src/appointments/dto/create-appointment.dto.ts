import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAppointmentDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '2026-04-10T09:00:00.000Z' })
  @IsDateString()
  dateTime: string;

  @ApiProperty({ default: 60, minimum: 15, maximum: 480 })
  @IsInt()
  @Min(15)
  @Max(480)
  durationMinutes: number = 60;

  @ApiProperty()
  @IsInt()
  providerId: number;
}
