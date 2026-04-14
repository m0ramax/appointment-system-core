import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, UserRole } from '@prisma/client';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkScheduleService } from '../work-schedule/work-schedule.service';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  appointment: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockWorkSchedule = {
  getAvailability: jest.fn(),
};

// Helper to build a minimal appointment object
function makeAppt(overrides: Partial<{
  id: number;
  status: AppointmentStatus;
  clientId: number;
  providerId: number;
  title: string;
  dateTime: Date;
  durationMinutes: number;
}> = {}) {
  return {
    id: 1,
    status: AppointmentStatus.PENDING,
    clientId: 10,
    providerId: 20,
    title: 'Test Appointment',
    dateTime: new Date('2026-04-21T10:00:00Z'),
    durationMinutes: 60,
    ...overrides,
  };
}

describe('AppointmentsService', () => {
  let service: AppointmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WorkScheduleService, useValue: mockWorkSchedule },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
    jest.clearAllMocks();
  });

  // ── validateTransition (tested via update()) ──────────────────────────────

  describe('validateTransition via update()', () => {
    const providerUser = { id: 20, role: UserRole.PROVIDER };
    const clientUser = { id: 10, role: UserRole.CLIENT };

    it('allows PENDING → CONFIRMED by PROVIDER', async () => {
      const appt = makeAppt({ status: AppointmentStatus.PENDING });
      mockPrisma.appointment.findUnique.mockResolvedValue(appt);
      mockPrisma.appointment.update.mockResolvedValue({
        ...appt,
        status: AppointmentStatus.CONFIRMED,
      });

      await expect(
        service.update(1, { status: AppointmentStatus.CONFIRMED }, providerUser),
      ).resolves.not.toThrow();

      expect(mockPrisma.appointment.update).toHaveBeenCalledTimes(1);
    });

    it('throws ForbiddenException for PENDING → CONFIRMED by CLIENT', async () => {
      const appt = makeAppt({ status: AppointmentStatus.PENDING });
      mockPrisma.appointment.findUnique.mockResolvedValue(appt);

      await expect(
        service.update(1, { status: AppointmentStatus.CONFIRMED }, clientUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows PENDING → CANCELLED by CLIENT', async () => {
      const appt = makeAppt({ status: AppointmentStatus.PENDING });
      mockPrisma.appointment.findUnique.mockResolvedValue(appt);
      mockPrisma.appointment.update.mockResolvedValue({
        ...appt,
        status: AppointmentStatus.CANCELLED,
      });

      await expect(
        service.update(1, { status: AppointmentStatus.CANCELLED }, clientUser),
      ).resolves.not.toThrow();
    });

    it('allows CONFIRMED → COMPLETED by PROVIDER', async () => {
      const appt = makeAppt({ status: AppointmentStatus.CONFIRMED });
      mockPrisma.appointment.findUnique.mockResolvedValue(appt);
      mockPrisma.appointment.update.mockResolvedValue({
        ...appt,
        status: AppointmentStatus.COMPLETED,
      });

      await expect(
        service.update(1, { status: AppointmentStatus.COMPLETED }, providerUser),
      ).resolves.not.toThrow();
    });

    it('throws BadRequestException for COMPLETED → CANCELLED (terminal state)', async () => {
      const appt = makeAppt({ status: AppointmentStatus.COMPLETED });
      mockPrisma.appointment.findUnique.mockResolvedValue(appt);

      await expect(
        service.update(1, { status: AppointmentStatus.CANCELLED }, providerUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for CANCELLED → CONFIRMED (terminal state)', async () => {
      const appt = makeAppt({ status: AppointmentStatus.CANCELLED });
      mockPrisma.appointment.findUnique.mockResolvedValue(appt);

      await expect(
        service.update(1, { status: AppointmentStatus.CONFIRMED }, providerUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── checkOverlap ──────────────────────────────────────────────────────────

  describe('checkOverlap()', () => {
    it('does not throw when there are no existing appointments', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([]);

      await expect(
        service.checkOverlap(20, new Date('2026-04-21T10:00:00Z'), 60),
      ).resolves.not.toThrow();
    });

    it('throws BadRequestException when new appointment overlaps exactly with existing', async () => {
      // Existing: 10:00–11:00
      // New:      10:00–11:00 → overlap
      mockPrisma.appointment.findMany.mockResolvedValue([
        makeAppt({
          dateTime: new Date('2026-04-21T10:00:00Z'),
          durationMinutes: 60,
          title: 'Existing Appt',
        }),
      ]);

      await expect(
        service.checkOverlap(20, new Date('2026-04-21T10:00:00Z'), 60),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when new appointment partially overlaps existing', async () => {
      // Existing: 10:00–11:00
      // New:      10:30–11:30 → overlap
      mockPrisma.appointment.findMany.mockResolvedValue([
        makeAppt({
          dateTime: new Date('2026-04-21T10:00:00Z'),
          durationMinutes: 60,
          title: 'Existing Appt',
        }),
      ]);

      await expect(
        service.checkOverlap(20, new Date('2026-04-21T10:30:00Z'), 60),
      ).rejects.toThrow(BadRequestException);
    });

    it('does not throw for back-to-back (adjacent) appointments — no overlap', async () => {
      // Existing: 10:00–11:00
      // New:      11:00–12:00 → adjacent, no overlap
      mockPrisma.appointment.findMany.mockResolvedValue([
        makeAppt({
          dateTime: new Date('2026-04-21T10:00:00Z'),
          durationMinutes: 60,
          title: 'Existing Appt',
        }),
      ]);

      await expect(
        service.checkOverlap(20, new Date('2026-04-21T11:00:00Z'), 60),
      ).resolves.not.toThrow();
    });
  });

  // ── remove() ──────────────────────────────────────────────────────────────

  describe('remove()', () => {
    const user = { id: 10, role: UserRole.CLIENT };

    it('deletes a PENDING appointment successfully', async () => {
      const appt = makeAppt({ status: AppointmentStatus.PENDING });
      mockPrisma.appointment.findUnique.mockResolvedValue(appt);
      mockPrisma.appointment.delete.mockResolvedValue(appt);

      await expect(service.remove(1, user)).resolves.not.toThrow();
      expect(mockPrisma.appointment.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('throws BadRequestException when trying to delete a CONFIRMED appointment', async () => {
      const appt = makeAppt({ status: AppointmentStatus.CONFIRMED });
      mockPrisma.appointment.findUnique.mockResolvedValue(appt);

      await expect(service.remove(1, user)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.appointment.delete).not.toHaveBeenCalled();
    });
  });

  // ── create() ──────────────────────────────────────────────────────────────

  describe('create()', () => {
    const clientId = 10;
    const futureDate = '2026-12-01T10:00:00Z';
    const baseDto = {
      title: 'New Appt',
      description: 'Desc',
      dateTime: futureDate,
      durationMinutes: 60,
      providerId: 20,
    };

    it('throws NotFoundException when provider does not exist', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.create(baseDto, clientId)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when dateTime is in the past', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 20,
        role: UserRole.PROVIDER,
      });

      const pastDto = { ...baseDto, dateTime: '2020-01-01T10:00:00Z' };

      await expect(service.create(pastDto, clientId)).rejects.toThrow(BadRequestException);
    });

    it('creates appointment when all validations pass', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 20,
        role: UserRole.PROVIDER,
      });
      mockPrisma.appointment.findMany.mockResolvedValue([]);
      mockWorkSchedule.getAvailability.mockResolvedValue({
        isAvailable: true,
        reason: 'Slots disponibles',
        availableSlots: [{ start: '09:00', end: '17:00' }],
      });
      const createdAppt = makeAppt({ status: AppointmentStatus.PENDING });
      mockPrisma.appointment.create.mockResolvedValue(createdAppt);

      const result = await service.create(baseDto, clientId);

      expect(result).toEqual(createdAppt);
      expect(mockPrisma.appointment.create).toHaveBeenCalledTimes(1);
    });
  });
});
