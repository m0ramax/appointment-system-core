import { Test, TestingModule } from '@nestjs/testing';
import { PlatformSettingsService } from './platform-settings.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  platformSettings: {
    findUnique: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
  },
};

describe('PlatformSettingsService', () => {
  let service: PlatformSettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformSettingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PlatformSettingsService>(PlatformSettingsService);
    jest.clearAllMocks();
  });

  describe('getSettings()', () => {
    it('returns existing settings when they exist', async () => {
      const settings = { id: 1, registrationEnabled: true };
      mockPrisma.platformSettings.findUnique.mockResolvedValue(settings);

      const result = await service.getSettings();

      expect(result).toEqual(settings);
      expect(mockPrisma.platformSettings.create).not.toHaveBeenCalled();
    });

    it('creates default settings when none exist', async () => {
      mockPrisma.platformSettings.findUnique.mockResolvedValue(null);
      mockPrisma.platformSettings.create.mockResolvedValue({ id: 1, registrationEnabled: true });

      const result = await service.getSettings();

      expect(result).toEqual({ id: 1, registrationEnabled: true });
      expect(mockPrisma.platformSettings.create).toHaveBeenCalledWith({
        data: { id: 1, registrationEnabled: true },
      });
    });
  });

  describe('updateSettings()', () => {
    it('disables registration', async () => {
      const updated = { id: 1, registrationEnabled: false };
      mockPrisma.platformSettings.upsert.mockResolvedValue(updated);

      const result = await service.updateSettings({ registrationEnabled: false });

      expect(result).toEqual(updated);
      expect(mockPrisma.platformSettings.upsert).toHaveBeenCalledWith({
        where: { id: 1 },
        update: { registrationEnabled: false },
        create: { id: 1, registrationEnabled: false },
      });
    });

    it('enables registration', async () => {
      const updated = { id: 1, registrationEnabled: true };
      mockPrisma.platformSettings.upsert.mockResolvedValue(updated);

      const result = await service.updateSettings({ registrationEnabled: true });

      expect(result).toEqual(updated);
    });
  });
});
