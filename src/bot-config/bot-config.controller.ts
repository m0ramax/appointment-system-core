import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BotConfigService } from './bot-config.service';
import { UpsertBotConfigDto } from './dto/upsert-bot-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('bot-config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bot-config')
export class BotConfigController {
  constructor(private service: BotConfigService) {}

  @Get()
  @Roles('OWNER')
  get(@CurrentUser() user: any) {
    return this.service.get(user.businessId);
  }

  @Patch()
  @Roles('OWNER')
  upsert(@CurrentUser() user: any, @Body() dto: UpsertBotConfigDto) {
    return this.service.upsert(user.businessId, dto);
  }
}
