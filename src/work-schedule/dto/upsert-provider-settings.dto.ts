import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpsertProviderSettingsDto {
  @ApiProperty({ required: false, default: 30 })
  @IsInt()
  @Min(1)
  @IsOptional()
  defaultSlotDuration?: number;

  @ApiProperty({ required: false, default: 30 })
  @IsInt()
  @Min(1)
  @IsOptional()
  advanceBookingDays?: number;

  @ApiProperty({ required: false, default: true })
  @IsBoolean()
  @IsOptional()
  sameDayBooking?: boolean;

  @ApiProperty({ required: false, default: 'UTC' })
  @IsString()
  @IsOptional()
  timezone?: string;
}
