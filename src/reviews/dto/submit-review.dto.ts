import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ required: false, example: 'Excelente atención' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  comment?: string;

  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  @MaxLength(100)
  clientName: string;
}
