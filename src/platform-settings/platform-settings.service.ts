import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';

@Injectable()
export class PlatformSettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings() {
    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: 1 },
    });
    if (settings) return settings;

    return this.prisma.platformSettings.create({
      data: { id: 1, registrationEnabled: true },
    });
  }

  async updateSettings(dto: UpdatePlatformSettingsDto) {
    return this.prisma.platformSettings.upsert({
      where: { id: 1 },
      update: { registrationEnabled: dto.registrationEnabled },
      create: { id: 1, registrationEnabled: dto.registrationEnabled },
    });
  }
}
