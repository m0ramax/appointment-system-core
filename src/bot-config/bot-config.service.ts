import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertBotConfigDto } from './dto/upsert-bot-config.dto';

@Injectable()
export class BotConfigService {
  constructor(private prisma: PrismaService) {}

  async get(businessId: number) {
    return this.prisma.businessBotConfig.findUnique({ where: { businessId } });
  }

  async upsert(businessId: number, dto: UpsertBotConfigDto) {
    return this.prisma.businessBotConfig.upsert({
      where: { businessId },
      create: { ...dto, businessId },
      update: dto,
    });
  }
}
