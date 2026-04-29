import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateWhatsappConfigDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  whatsappWelcome?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  whatsappConfirmation?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  whatsappCancellation?: string;

  @ApiProperty({ required: false, minimum: 15, example: 30 })
  @IsInt()
  @Min(15)
  @IsOptional()
  appointmentDuration?: number;

  @ApiProperty({ required: false, example: 'America/Santiago' })
  @IsString()
  @IsOptional()
  @MaxLength(60)
  timezone?: string;
}
