import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('services')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('services')
export class ServicesController {
  constructor(private service: ServicesService) {}

  @Post()
  @Roles('OWNER')
  create(@Body() dto: CreateServiceDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.businessId);
  }

  @Get('business/:businessId')
  findByBusiness(@Param('businessId', ParseIntPipe) businessId: number) {
    return this.service.findByBusiness(businessId);
  }

  @Put(':id')
  @Roles('OWNER')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() user: any,
  ) {
    return this.service.update(id, dto, user.businessId);
  }

  @Delete(':id')
  @Roles('OWNER')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.service.remove(id, user.businessId);
  }
}
