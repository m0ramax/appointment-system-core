import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AppointmentStatus, DayOfWeek, ExceptionType } from '@prisma/client';
import { WorkScheduleService } from './work-schedule.service';
import { PrismaService } from '../prisma/prisma.service';

// "2026-04-21" is a Tuesday
// "2026-04-20" is a Monday
const MONDAY = '2026-04-21';

const mockPrisma = {
  workSchedule: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  scheduleException: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  appointment: {
    findMany: jest.fn(),
  },
  providerSettings: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
  },
};

// Helper: build a minimal work schedule
function makeSchedule(overrides: Partial<{
  providerId: number;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  breakStart: string | null;
  breakEnd: string | null;
  isActive: boolean;
}> = {}) {
  return {
    id: 1,
    providerId: 1,
    dayOfWeek: DayOfWeek.TUESDAY, // 2026-04-21 is a Tuesday
    startTime: '09:00',
    endTime: '17:00',
    slotDurationMinutes: 60,
    breakStart: null,
    breakEnd: null,
    isActive: true,
    ...overrides,
  };
}

// Helper: build a minimal booked appointment
function makeBookedAppt(hourUTC: number, durationMinutes = 60) {
  const dt = new Date(`${MONDAY}T${String(hourUTC).padStart(2, '0')}:00:00Z`);
  return {
    id: 99,
    providerId: 1,
    dateTime: dt,
    durationMinutes,
    status: AppointmentStatus.CONFIRMED,
    title: 'Booked',
  };
}

describe('WorkScheduleService', () => {
  let service: WorkScheduleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkScheduleService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<WorkScheduleService>(WorkScheduleService);
    jest.clearAllMocks();
  });

  // ── getAvailability() ─────────────────────────────────────────────────────

  describe('getAvailability()', () => {
    it('returns { isAvailable: false } when no schedule exists for the day', async () => {
      mockPrisma.scheduleException.findUnique.mockResolvedValue(null);
      mockPrisma.workSchedule.findUnique.mockResolvedValue(null);

      const result = await service.getAvailability(1, MONDAY);

      expect(result.isAvailable).toBe(false);
      expect(result.availableSlots).toHaveLength(0);
    });

    it('returns slots when schedule exists and no appointments are booked', async () => {
      mockPrisma.scheduleException.findUnique.mockResolvedValue(null);
      mockPrisma.workSchedule.findUnique.mockResolvedValue(
        makeSchedule({ startTime: '09:00', endTime: '11:00', slotDurationMinutes: 60 }),
      );
      mockPrisma.appointment.findMany.mockResolvedValue([]);

      const result = await service.getAvailability(1, MONDAY);

      expect(result.isAvailable).toBe(true);
      // 09:00–11:00 with 60-min slots → slots: 09:00–10:00, 10:00–11:00
      expect(result.availableSlots).toEqual([
        { start: '09:00', end: '10:00' },
        { start: '10:00', end: '11:00' },
      ]);
    });

    it('excludes slots that fall within a break (13:00–14:00)', async () => {
      mockPrisma.scheduleException.findUnique.mockResolvedValue(null);
      mockPrisma.workSchedule.findUnique.mockResolvedValue(
        makeSchedule({
          startTime: '12:00',
          endTime: '15:00',
          slotDurationMinutes: 60,
          breakStart: '13:00',
          breakEnd: '14:00',
        }),
      );
      mockPrisma.appointment.findMany.mockResolvedValue([]);

      const result = await service.getAvailability(1, MONDAY);

      expect(result.isAvailable).toBe(true);
      // 12:00–15:00 with 60-min slots: 12:00–13:00, 13:00–14:00, 14:00–15:00
      // 13:00–14:00 overlaps break → excluded
      const slotTimes = result.availableSlots.map((s: { start: string; end: string }) => s.start);
      expect(slotTimes).toContain('12:00');
      expect(slotTimes).toContain('14:00');
      expect(slotTimes).not.toContain('13:00');
    });

    it('returns { isAvailable: false } when there is a DAY_OFF exception', async () => {
      mockPrisma.scheduleException.findUnique.mockResolvedValue({
        id: 5,
        providerId: 1,
        date: new Date(MONDAY),
        exceptionType: ExceptionType.DAY_OFF,
        reason: 'Personal day',
        startTime: null,
        endTime: null,
        slotDurationMinutes: null,
      });

      const result = await service.getAvailability(1, MONDAY);

      expect(result.isAvailable).toBe(false);
      expect(result.availableSlots).toHaveLength(0);
      // workSchedule should not be consulted
      expect(mockPrisma.workSchedule.findUnique).not.toHaveBeenCalled();
    });

    it('uses CUSTOM_HOURS exception instead of the regular schedule', async () => {
      mockPrisma.scheduleException.findUnique.mockResolvedValue({
        id: 6,
        providerId: 1,
        date: new Date(MONDAY),
        exceptionType: ExceptionType.CUSTOM_HOURS,
        reason: null,
        startTime: '14:00',
        endTime: '16:00',
        slotDurationMinutes: 60,
      });
      mockPrisma.appointment.findMany.mockResolvedValue([]);

      const result = await service.getAvailability(1, MONDAY);

      expect(result.isAvailable).toBe(true);
      expect(result.availableSlots).toEqual([
        { start: '14:00', end: '15:00' },
        { start: '15:00', end: '16:00' },
      ]);
      // Regular schedule should not be consulted
      expect(mockPrisma.workSchedule.findUnique).not.toHaveBeenCalled();
    });

    it('returns { isAvailable: false } when all slots are booked', async () => {
      mockPrisma.scheduleException.findUnique.mockResolvedValue(null);
      // Schedule: 09:00–11:00, 60-min slots → two slots: 09:00 and 10:00
      mockPrisma.workSchedule.findUnique.mockResolvedValue(
        makeSchedule({ startTime: '09:00', endTime: '11:00', slotDurationMinutes: 60 }),
      );
      // Both slots booked
      mockPrisma.appointment.findMany.mockResolvedValue([
        makeBookedAppt(9, 60),  // occupies 09:00–10:00
        makeBookedAppt(10, 60), // occupies 10:00–11:00
      ]);

      const result = await service.getAvailability(1, MONDAY);

      expect(result.isAvailable).toBe(false);
      expect(result.availableSlots).toHaveLength(0);
    });
  });

  // ── createSchedule() ──────────────────────────────────────────────────────

  describe('createSchedule()', () => {
    const dto = {
      providerId: 1,
      dayOfWeek: DayOfWeek.TUESDAY,
      startTime: '09:00',
      endTime: '17:00',
      slotDurationMinutes: 30,
      isActive: true,
      breakStart: null,
      breakEnd: null,
    };

    it('creates a schedule when one does not exist yet', async () => {
      mockPrisma.workSchedule.findUnique.mockResolvedValue(null);
      mockPrisma.workSchedule.create.mockResolvedValue({ id: 1, ...dto });

      const result = await service.createSchedule(dto);

      expect(result).toMatchObject({ id: 1, dayOfWeek: DayOfWeek.TUESDAY });
      expect(mockPrisma.workSchedule.create).toHaveBeenCalledWith({ data: dto });
    });

    it('throws BadRequestException when a schedule already exists for that day', async () => {
      mockPrisma.workSchedule.findUnique.mockResolvedValue({ id: 1, ...dto });

      await expect(service.createSchedule(dto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.workSchedule.create).not.toHaveBeenCalled();
    });
  });
});
