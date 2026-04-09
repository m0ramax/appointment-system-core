import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ExceptionType } from '@prisma/client';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const timeMsg = 'Must be HH:MM format (e.g. 09:00)';

export class CreateExceptionDto {
  @ApiProperty()
  @IsInt()
  providerId: number;

  @ApiProperty({ example: '2026-04-10' })
  @IsDateString()
  date: string;

  @ApiProperty({ enum: ExceptionType })
  @IsEnum(ExceptionType)
  exceptionType: ExceptionType;

  @ApiProperty({ required: false })
  @IsString()
  @Matches(TIME_REGEX, { message: timeMsg })
  @IsOptional()
  startTime?: string;

  @ApiProperty({ required: false })
  @IsString()
  @Matches(TIME_REGEX, { message: timeMsg })
  @IsOptional()
  endTime?: string;

  @ApiProperty({ required: false })
  @IsInt()
  @IsOptional()
  slotDurationMinutes?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  reason?: string;
}
