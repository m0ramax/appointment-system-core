import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UpdateTeamModeDto } from './dto/update-team-mode.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateAdminBusinessDto } from './dto/update-admin-business.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private service: AdminService) {}

  @Get('businesses')
  findAll() {
    return this.service.findAllBusinesses();
  }

  @Patch('businesses/:id/suspend')
  suspend(@Param('id', ParseIntPipe) id: number) {
    return this.service.toggleSuspend(id, true);
  }

  @Patch('businesses/:id/activate')
  activate(@Param('id', ParseIntPipe) id: number) {
    return this.service.toggleSuspend(id, false);
  }

  @Patch('businesses/:id/team-mode')
  setTeamMode(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTeamModeDto) {
    return this.service.setTeamMode(id, dto.teamMode);
  }

  @Patch('businesses/:id')
  updateBusiness(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAdminBusinessDto) {
    return this.service.updateBusiness(id, dto);
  }

  @Delete('businesses/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteBusiness(id);
  }

  @Get('users')
  findAllUsers() {
    return this.service.findAllUsers();
  }

  @Patch('users/:id')
  updateUser(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.service.updateUser(id, dto);
  }
}
