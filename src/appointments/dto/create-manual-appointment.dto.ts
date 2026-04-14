import { IsDateString, IsEmail, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateManualAppointmentDto {
  @ApiProperty({ example: 'cliente@ejemplo.com' })
  @IsEmail()
  clientEmail: string;

  @ApiProperty()
  @IsInt()
  providerId: number;

  @ApiProperty({ required: false })
  @IsInt()
  @IsOptional()
  serviceId?: number;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '2026-04-15T09:00:00.000Z' })
  @IsDateString()
  dateTime: string;

  @ApiProperty({ default: 60, minimum: 15, maximum: 480 })
  @IsInt()
  @Min(15)
  @Max(480)
  durationMinutes: number = 60;
}
