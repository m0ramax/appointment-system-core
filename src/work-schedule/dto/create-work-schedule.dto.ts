import { IsEnum, IsInt, IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DayOfWeek } from '@prisma/client';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const timeMsg = 'Must be HH:MM format (e.g. 09:00)';

export class CreateWorkScheduleDto {
  @ApiProperty()
  @IsInt()
  providerId: number;

  @ApiProperty({ enum: DayOfWeek })
  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  @ApiProperty({ example: '09:00' })
  @IsString()
  @Matches(TIME_REGEX, { message: timeMsg })
  startTime: string;

  @ApiProperty({ example: '17:00' })
  @IsString()
  @Matches(TIME_REGEX, { message: timeMsg })
  endTime: string;

  @ApiProperty({ default: 30 })
  @IsInt()
  @IsOptional()
  slotDurationMinutes?: number;

  @ApiProperty({ required: false, example: '12:00' })
  @IsString()
  @Matches(TIME_REGEX, { message: timeMsg })
  @IsOptional()
  breakStart?: string;

  @ApiProperty({ required: false, example: '13:00' })
  @IsString()
  @Matches(TIME_REGEX, { message: timeMsg })
  @IsOptional()
  breakEnd?: string;
}
