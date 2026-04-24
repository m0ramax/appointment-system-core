import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto, RegisterOwnerDto, RegisterProviderDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { InviteService } from '../invite/invite.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private invite: InviteService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 300_000 } })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('register/owner')
  @Throttle({ default: { limit: 10, ttl: 300_000 } })
  async registerOwner(@Body() dto: RegisterOwnerDto, @Query('token') token: string) {
    const invite = await this.invite.validate(token);
    const result = await this.auth.registerOwner(dto);
    return { ...result, inviteToken: invite.token };
  }

  @Post('register/super-admin')
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  registerSuperAdmin(@Body() dto: RegisterDto, @Query('secret') secret: string) {
    return this.auth.registerSuperAdmin(dto, secret);
  }

  @Post('register/provider')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER')
  registerProvider(@Body() dto: RegisterProviderDto, @CurrentUser() user: any) {
    return this.auth.registerProvider(dto, user.businessId);
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 300_000 } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: any) {
    return user;
  }
}
