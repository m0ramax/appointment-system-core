import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { CreateManualAppointmentDto } from './dto/create-manual-appointment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('appointments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private service: AppointmentsService) {}

  @Post()
  @Roles('CLIENT')
  create(@Body() dto: CreateAppointmentDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.id);
  }

  @Post('manual')
  @Roles('OWNER')
  createManual(@Body() dto: CreateManualAppointmentDto, @CurrentUser() user: any) {
    return this.service.createManual(dto, user.businessId);
  }

  @Get('business')
  @Roles('OWNER')
  findByBusiness(
    @CurrentUser() user: any,
    @Query('date') date?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('all') all?: string,
  ) {
    return this.service.findByBusiness(user.businessId, date, startDate, endDate, all === 'true');
  }

  @Get('providers')
  getProviders() {
    return this.service.getProviders();
  }

  @Get('me')
  findMine(@CurrentUser() user: any) {
    return this.service.findMine(user);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.service.findOne(id, user);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() user: any,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.service.remove(id, user);
  }
}
