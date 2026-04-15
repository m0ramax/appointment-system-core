import { Body, Controller, Get, Param, Post, Put, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InviteService } from './invite.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('invite')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('invite')
export class InviteController {
  constructor(private service: InviteService) {}

  @Post()
  @Roles('SUPER_ADMIN')
  create(@Body() body: { note?: string }) {
    return this.service.create(body.note);
  }

  @Get()
  @Roles('SUPER_ADMIN')
  findAll() {
    return this.service.findAll();
  }

  @Get('stats')
  @Roles('SUPER_ADMIN')
  getStats() {
    return this.service.getStats();
  }

  @Get('validate/:token')
  validate(@Param('token') token: string) {
    return this.service.validate(token);
  }

  @Put(':id/revoke')
  @Roles('SUPER_ADMIN')
  revoke(@Param('id', ParseIntPipe) id: number) {
    return this.service.revoke(id);
  }
}
