import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBusinessDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ example: '+14155238886' })
  @IsString()
  whatsappNumber: string;

  @ApiProperty({ default: false, required: false })
  @IsBoolean()
  @IsOptional()
  allowProviderSelection?: boolean;
}
