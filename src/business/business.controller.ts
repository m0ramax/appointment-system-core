import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BusinessService } from './business.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { UpdateWhatsappNumberDto } from './dto/update-whatsapp-number.dto';
import { UpdateWhatsappConfigDto } from './dto/update-whatsapp-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('business')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('business')
export class BusinessController {
  constructor(private service: BusinessService) {}

  @Post()
  @Roles('OWNER')
  create(@Body() dto: CreateBusinessDto, @CurrentUser() user: any, @Query('token') token?: string) {
    return this.service.create(dto, user.id, token);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('team')
  @Roles('OWNER')
  getTeam(@CurrentUser() user: any) {
    return this.service.getTeam(user.businessId);
  }

  @Patch('whatsapp-number')
  @Roles('OWNER')
  updateWhatsappNumber(@Body() dto: UpdateWhatsappNumberDto, @CurrentUser() user: any) {
    return this.service.updateWhatsappNumber(user.businessId, dto);
  }

  @Get('bot-status')
  @Roles('OWNER')
  getBotStatus(@CurrentUser() user: any) {
    return this.service.getBotStatus(user.businessId);
  }

  @Patch('me/whatsapp-config')
  @Roles('OWNER')
  updateWhatsappConfig(@Body() dto: UpdateWhatsappConfigDto, @CurrentUser() user: any) {
    return this.service.updateWhatsappConfig(user.businessId, dto);
  }

  @Public()
  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @Roles('OWNER')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBusinessDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('OWNER')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
