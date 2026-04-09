import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateServiceDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ default: 30, minimum: 15 })
  @IsInt()
  @Min(15)
  @IsOptional()
  durationMinutes?: number;
}
