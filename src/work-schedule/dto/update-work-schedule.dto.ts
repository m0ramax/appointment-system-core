import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const timeMsg = 'Must be HH:MM format (e.g. 09:00)';

export class UpdateWorkScheduleDto {
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
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @Matches(TIME_REGEX, { message: timeMsg })
  @IsOptional()
  breakStart?: string;

  @ApiProperty({ required: false })
  @IsString()
  @Matches(TIME_REGEX, { message: timeMsg })
  @IsOptional()
  breakEnd?: string;
}
