import { IsDecimal, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateServiceDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false, example: '25.00' })
  @IsDecimal({ decimal_digits: '0,2' })
  @IsOptional()
  price?: string;

  @ApiProperty({ default: 30, minimum: 15 })
  @IsInt()
  @Min(15)
  @IsOptional()
  durationMinutes?: number;
}
