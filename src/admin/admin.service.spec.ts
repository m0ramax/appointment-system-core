import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  business: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const businessWithCounts = {
  id: 1,
  name: 'Peluquería Test',
  suspended: false,
  teamMode: false,
  _count: { users: 2, services: 3, appointments: 10 },
};

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    jest.clearAllMocks();
  });

  describe('findAllBusinesses()', () => {
    it('returns all businesses with user/service/appointment counts', async () => {
      mockPrisma.business.findMany.mockResolvedValue([businessWithCounts]);

      const result = await service.findAllBusinesses();

      expect(result).toEqual([businessWithCounts]);
      expect(mockPrisma.business.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({ _count: expect.any(Object) }),
          orderBy: { id: 'asc' },
        }),
      );
    });
  });

  describe('toggleSuspend()', () => {
    it('suspends an active business', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({ id: 1, suspended: false });
      mockPrisma.business.update.mockResolvedValue({ ...businessWithCounts, suspended: true });

      const result = await service.toggleSuspend(1, true);

      expect(result.suspended).toBe(true);
      expect(mockPrisma.business.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { suspended: true },
        }),
      );
    });

    it('reactivates a suspended business', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({ id: 1, suspended: true });
      mockPrisma.business.update.mockResolvedValue({ ...businessWithCounts, suspended: false });

      const result = await service.toggleSuspend(1, false);

      expect(result.suspended).toBe(false);
    });

    it('throws NotFoundException when business does not exist', async () => {
      mockPrisma.business.findUnique.mockResolvedValue(null);

      await expect(service.toggleSuspend(999, true)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.business.update).not.toHaveBeenCalled();
    });
  });

  describe('setTeamMode()', () => {
    it('enables team mode', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({ id: 1, teamMode: false });
      mockPrisma.business.update.mockResolvedValue({ ...businessWithCounts, teamMode: true });

      const result = await service.setTeamMode(1, true);

      expect(result.teamMode).toBe(true);
      expect(mockPrisma.business.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { teamMode: true },
        }),
      );
    });

    it('throws NotFoundException when business does not exist', async () => {
      mockPrisma.business.findUnique.mockResolvedValue(null);

      await expect(service.setTeamMode(999, true)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteBusiness()', () => {
    it('deletes an existing business', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.business.delete.mockResolvedValue({ id: 1 });

      await service.deleteBusiness(1);

      expect(mockPrisma.business.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('throws NotFoundException when business does not exist', async () => {
      mockPrisma.business.findUnique.mockResolvedValue(null);

      await expect(service.deleteBusiness(999)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.business.delete).not.toHaveBeenCalled();
    });
  });
});
