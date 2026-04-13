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
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { WorkScheduleService } from './work-schedule.service';
import { CreateWorkScheduleDto } from './dto/create-work-schedule.dto';
import { UpdateWorkScheduleDto } from './dto/update-work-schedule.dto';
import { CreateExceptionDto } from './dto/create-exception.dto';
import { UpsertProviderSettingsDto } from './dto/upsert-provider-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('work-schedules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('work-schedules')
export class WorkScheduleController {
  constructor(private service: WorkScheduleService) {}

  // ── Schedules ──────────────────────────────────────────────────────────────

  @Post()
  @Roles('PROVIDER', 'OWNER')
  @ApiQuery({ name: 'forProvider', required: false })
  createSchedule(
    @Body() dto: CreateWorkScheduleDto,
    @CurrentUser() user: any,
    @Query('forProvider') forProvider?: string,
  ) {
    dto.providerId = forProvider && user.role === 'OWNER' ? +forProvider : user.id;
    return this.service.createSchedule(dto);
  }

  @Get()
  @Roles('PROVIDER', 'OWNER')
  @ApiQuery({ name: 'forProvider', required: false })
  getSchedules(
    @CurrentUser() user: any,
    @Query('forProvider') forProvider?: string,
  ) {
    const providerId = forProvider && user.role === 'OWNER' ? +forProvider : user.id;
    return this.service.getSchedules(providerId);
  }

  @Put(':id')
  @Roles('PROVIDER', 'OWNER')
  updateSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkScheduleDto,
  ) {
    return this.service.updateSchedule(id, dto);
  }

  @Delete(':id')
  @Roles('PROVIDER', 'OWNER')
  deleteSchedule(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteSchedule(id);
  }

  // ── Exceptions ─────────────────────────────────────────────────────────────

  @Post('exceptions')
  @Roles('PROVIDER', 'OWNER')
  createException(@Body() dto: CreateExceptionDto, @CurrentUser() user: any) {
    dto.providerId = user.id;
    return this.service.createException(dto);
  }

  @Get('exceptions')
  @Roles('PROVIDER', 'OWNER')
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getExceptions(
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.getExceptions(user.id, startDate, endDate);
  }

  @Delete('exceptions/:id')
  @Roles('PROVIDER', 'OWNER')
  deleteException(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteException(id);
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  @Post('settings')
  @Roles('PROVIDER', 'OWNER')
  upsertSettings(
    @CurrentUser() user: any,
    @Body() dto: UpsertProviderSettingsDto,
  ) {
    return this.service.upsertSettings(user.id, dto);
  }

  @Get('settings')
  @Roles('PROVIDER', 'OWNER')
  getSettings(@CurrentUser() user: any) {
    return this.service.getSettings(user.id);
  }

  // ── Availability (público con JWT) ─────────────────────────────────────────

  @Get('availability/:providerId/:date')
  getAvailability(
    @Param('providerId', ParseIntPipe) providerId: number,
    @Param('date') date: string,
  ) {
    return this.service.getAvailability(providerId, date);
  }
}
