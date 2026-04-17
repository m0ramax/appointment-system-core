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
  business: {
    findUnique: jest.fn(),
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
      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.role).toBe(UserRole.OWNER);
    });

    it('throws ConflictException when owner email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 10, email: 'owner@test.com' });

      await expect(
        service.registerOwner({ email: 'owner@test.com', password: 'ownerpass' }),
      ).rejects.toThrow(ConflictException);
    });

    it('succeeds even when registrationEnabled is false (invite bypasses flag)', async () => {
      mockPlatformSettings.getSettings.mockResolvedValue({ id: 1, registrationEnabled: false });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 11,
        email: 'invited@test.com',
        role: UserRole.OWNER,
        businessId: null,
      });

      const result = await service.registerOwner({ email: 'invited@test.com', password: 'pass' });

      expect(result).toEqual({ access_token: 'signed-token' });
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('registerProvider()', () => {
    it('creates a PROVIDER user linked to the given businessId', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 20,
        email: 'provider@test.com',
        role: UserRole.PROVIDER,
        businessId: 5,
      });

      const result = await service.registerProvider(
        { email: 'provider@test.com', password: 'provpass' },
        5,
      );

      expect(result).toEqual({ access_token: 'signed-token' });
      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.role).toBe(UserRole.PROVIDER);
      expect(createCall.data.businessId).toBe(5);
    });

    it('throws ConflictException when email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 20, email: 'provider@test.com' });

      await expect(
        service.registerProvider({ email: 'provider@test.com', password: 'pass' }, 5),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('registerSuperAdmin()', () => {
    it('returns access_token when secret is correct', async () => {
      mockConfig.get.mockReturnValue('correct-secret');
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 99,
        email: 'admin@tucita.app',
        role: UserRole.SUPER_ADMIN,
        businessId: null,
      });

      const result = await service.registerSuperAdmin(
        { email: 'admin@tucita.app', password: 'adminpass' },
        'correct-secret',
      );

      expect(result).toEqual({ access_token: 'signed-token' });
      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.role).toBe(UserRole.SUPER_ADMIN);
    });

    it('throws ForbiddenException when secret is wrong', async () => {
      mockConfig.get.mockReturnValue('correct-secret');

      await expect(
        service.registerSuperAdmin(
          { email: 'admin@tucita.app', password: 'adminpass' },
          'wrong-secret',
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when SUPER_ADMIN_SECRET is not configured', async () => {
      mockConfig.get.mockReturnValue(undefined);

      await expect(
        service.registerSuperAdmin(
          { email: 'admin@tucita.app', password: 'adminpass' },
          'any-secret',
        ),
      ).rejects.toThrow(ForbiddenException);
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

    it('throws ForbiddenException when OWNER business is suspended', async () => {
      const ownerUser = {
        id: 30,
        email: 'owner@test.com',
        role: UserRole.OWNER,
        businessId: 7,
        hashedPassword: 'hashed-password',
      };
      mockPrisma.user.findUnique.mockResolvedValue(ownerUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.business.findUnique.mockResolvedValue({ suspended: true });

      await expect(
        service.login({ email: 'owner@test.com', password: 'correct' }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockJwt.sign).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when PROVIDER business is suspended', async () => {
      const providerUser = {
        id: 31,
        email: 'provider@test.com',
        role: UserRole.PROVIDER,
        businessId: 7,
        hashedPassword: 'hashed-password',
      };
      mockPrisma.user.findUnique.mockResolvedValue(providerUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.business.findUnique.mockResolvedValue({ suspended: true });

      await expect(
        service.login({ email: 'provider@test.com', password: 'correct' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns token for OWNER when business is active', async () => {
      const ownerUser = {
        id: 32,
        email: 'active-owner@test.com',
        role: UserRole.OWNER,
        businessId: 8,
        hashedPassword: 'hashed-password',
      };
      mockPrisma.user.findUnique.mockResolvedValue(ownerUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.business.findUnique.mockResolvedValue({ suspended: false });

      const result = await service.login({ email: 'active-owner@test.com', password: 'correct' });

      expect(result).toEqual({ access_token: 'signed-token' });
    });
  });
});
