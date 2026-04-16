import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

jest.mock('bcrypt', () => ({
  hash:    jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('signed-token'),
};

const mockConfig = {
  get: jest.fn(),
};

const mockPlatformSettings = {
  getSettings: jest.fn().mockResolvedValue({ id: 1, registrationEnabled: true }),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: PlatformSettingsService, useValue: mockPlatformSettings },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    mockPlatformSettings.getSettings.mockResolvedValue({ id: 1, registrationEnabled: true });
  });

  describe('register()', () => {
    it('returns access_token when email is not taken', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 1,
        email: 'client@test.com',
        role: UserRole.CLIENT,
        businessId: null,
      });

      const result = await service.register({
        email: 'client@test.com',
        password: 'secret',
      });

      expect(result).toEqual({ access_token: 'signed-token' });
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'client@test.com' },
      });
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException when email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'existing@test.com',
      });

      await expect(
        service.register({ email: 'existing@test.com', password: 'secret' }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('hashes the password before storing', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 2,
        email: 'hash@test.com',
        role: UserRole.CLIENT,
        businessId: null,
      });

      await service.register({ email: 'hash@test.com', password: 'plaintext' });

      expect(bcrypt.hash).toHaveBeenCalledWith('plaintext', 10);
    });
  });

  describe('registerOwner()', () => {
    it('returns access_token for owner registration', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 10,
        email: 'owner@test.com',
        role: UserRole.OWNER,
        businessId: null,
      });

      const result = await service.registerOwner({
        email: 'owner@test.com',
        password: 'ownerpass',
      });

      expect(result).toEqual({ access_token: 'signed-token' });
      // role passed to create should be OWNER
      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.role).toBe(UserRole.OWNER);
    });

    it('throws ConflictException when owner email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 10, email: 'owner@test.com' });

      await expect(
        service.registerOwner({ email: 'owner@test.com', password: 'ownerpass' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ForbiddenException when registration is disabled', async () => {
      mockPlatformSettings.getSettings.mockResolvedValue({ id: 1, registrationEnabled: false });

      await expect(
        service.registerOwner({ email: 'new@test.com', password: 'pass' }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login()', () => {
    const mockUser = {
      id: 5,
      email: 'user@test.com',
      role: UserRole.CLIENT,
      businessId: null,
      hashedPassword: 'hashed-password',
    };

    it('returns access_token with valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'user@test.com',
        password: 'correct-password',
      });

      expect(result).toEqual({ access_token: 'signed-token' });
      expect(mockJwt.sign).toHaveBeenCalledWith({
        sub: 5,
        email: 'user@test.com',
        role: UserRole.CLIENT,
        businessId: null,
      });
    });

    it('throws UnauthorizedException when user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ghost@test.com', password: 'any' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'user@test.com', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockJwt.sign).not.toHaveBeenCalled();
    });
  });
});
