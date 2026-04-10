import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minimum: 6 })
  @IsString()
  @MinLength(6)
  password: string;
}

export class RegisterOwnerDto extends RegisterDto {}

export class RegisterProviderDto extends RegisterDto {}
