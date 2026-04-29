import { IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateWhatsappConfigDto {
  @ApiProperty({ required: false, example: 'barberia_moramax' })
  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9_]+$/, { message: 'El slug solo puede contener letras minúsculas, números y guión bajo' })
  @MaxLength(60)
  slug?: string;

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
