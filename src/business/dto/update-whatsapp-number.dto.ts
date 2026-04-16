import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateWhatsappNumberDto {
  @ApiProperty({ example: 'whatsapp:+14155238886' })
  @IsString()
  @IsNotEmpty()
  whatsappNumber: string;
}
