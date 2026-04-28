import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAdminBusinessDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  whatsappNumber?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  allowProviderSelection?: boolean;
}
