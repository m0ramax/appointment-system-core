import { Controller, Delete, Get, Param, ParseIntPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

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

  @Delete('businesses/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteBusiness(id);
  }
}
