import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { InviteService } from './invite.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  inviteToken: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  business: {
    count: jest.fn(),
  },
  appointment: {
    count: jest.fn(),
  },
};

describe('InviteService', () => {
  let service: InviteService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InviteService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<InviteService>(InviteService);
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('creates an invite token expiring in 7 days', async () => {
      const fakeToken = { id: 1, token: 'uuid-123', note: 'Test invite', used: false };
      mockPrisma.inviteToken.create.mockResolvedValue(fakeToken);

      const result = await service.create('Test invite');

      expect(result).toEqual(fakeToken);
      const createCall = mockPrisma.inviteToken.create.mock.calls[0][0];
      expect(createCall.data.note).toBe('Test invite');
      // expiresAt should be ~7 days from now
      const diff = createCall.data.expiresAt.getTime() - Date.now();
      expect(diff).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
      expect(diff).toBeLessThan(8 * 24 * 60 * 60 * 1000);
    });

    it('creates invite without note', async () => {
      mockPrisma.inviteToken.create.mockResolvedValue({ id: 2, token: 'uuid-456', note: null, used: false });

      await service.create();

      const createCall = mockPrisma.inviteToken.create.mock.calls[0][0];
      expect(createCall.data.note).toBeUndefined();
    });
  });

  describe('findAll()', () => {
    it('returns all invite tokens ordered by createdAt desc', async () => {
      const tokens = [{ id: 2 }, { id: 1 }];
      mockPrisma.inviteToken.findMany.mockResolvedValue(tokens);

      const result = await service.findAll();

      expect(result).toEqual(tokens);
      expect(mockPrisma.inviteToken.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('validate()', () => {
    it('returns the invite when valid', async () => {
      const invite = {
        id: 1,
        token: 'valid-token',
        used: false,
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      };
      mockPrisma.inviteToken.findUnique.mockResolvedValue(invite);

      const result = await service.validate('valid-token');

      expect(result).toEqual(invite);
    });

    it('throws BadRequestException when token does not exist', async () => {
      mockPrisma.inviteToken.findUnique.mockResolvedValue(null);

      await expect(service.validate('ghost-token')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when token is already used', async () => {
      mockPrisma.inviteToken.findUnique.mockResolvedValue({
        id: 2,
        token: 'used-token',
        used: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      await expect(service.validate('used-token')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when token is expired', async () => {
      mockPrisma.inviteToken.findUnique.mockResolvedValue({
        id: 3,
        token: 'expired-token',
        used: false,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.validate('expired-token')).rejects.toThrow(BadRequestException);
    });
  });

  describe('markUsed()', () => {
    it('marks the token as used with the businessId', async () => {
      const updated = { id: 1, token: 'valid-token', used: true, usedByBusinessId: 42 };
      mockPrisma.inviteToken.update.mockResolvedValue(updated);

      const result = await service.markUsed('valid-token', 42);

      expect(result).toEqual(updated);
      expect(mockPrisma.inviteToken.update).toHaveBeenCalledWith({
        where: { token: 'valid-token' },
        data: { used: true, usedByBusinessId: 42 },
      });
    });
  });

  describe('revoke()', () => {
    it('revokes an invite by id', async () => {
      mockPrisma.inviteToken.update.mockResolvedValue({ id: 5, used: true });

      await service.revoke(5);

      expect(mockPrisma.inviteToken.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { used: true },
      });
    });
  });

  describe('getStats()', () => {
    it('returns businesses, appointments, and activeInvites counts', async () => {
      mockPrisma.business.count.mockResolvedValue(10);
      mockPrisma.appointment.count.mockResolvedValue(250);
      mockPrisma.inviteToken.count.mockResolvedValue(3);

      const result = await service.getStats();

      expect(result).toEqual({ businesses: 10, appointments: 250, activeInvites: 3 });
      expect(mockPrisma.inviteToken.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ used: false }),
        }),
      );
    });
  });
});
