import { Module } from '@nestjs/common';
import { BotConfigController } from './bot-config.controller';
import { BotConfigService } from './bot-config.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BotConfigController],
  providers: [BotConfigService],
  exports: [BotConfigService],
})
export class BotConfigModule {}
