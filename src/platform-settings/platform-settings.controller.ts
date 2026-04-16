import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformSettingsService } from './platform-settings.service';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('platform-settings')
@Controller('platform-settings')
export class PlatformSettingsController {
  constructor(private service: PlatformSettingsService) {}

  @Get()
  @Public()
  getSettings() {
    return this.service.getSettings();
  }

  @Patch()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  updateSettings(@Body() dto: UpdatePlatformSettingsDto) {
    return this.service.updateSettings(dto);
  }
}
