import { IsEmail, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Mínimo 8 caracteres, una mayúscula, una minúscula y un símbolo' })
  @IsString()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/, {
    message: 'La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula y un símbolo',
  })
  password: string;
}

export class RegisterOwnerDto extends RegisterDto {}

export class RegisterProviderDto extends RegisterDto {}
