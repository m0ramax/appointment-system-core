import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, DayOfWeek, ExceptionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkScheduleDto } from './dto/create-work-schedule.dto';
import { UpdateWorkScheduleDto } from './dto/update-work-schedule.dto';
import { CreateExceptionDto } from './dto/create-exception.dto';
import { UpsertProviderSettingsDto } from './dto/upsert-provider-settings.dto';

export interface TimeSlot {
  start: string;
  end: string;
}

// Maps JS Date.getDay() (0=Sun) to Prisma DayOfWeek enum
const JS_DAY_TO_ENUM: DayOfWeek[] = [
  DayOfWeek.SUNDAY,
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];

/** Converts "HH:MM" to total minutes since midnight */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** Converts total minutes to "HH:MM" */
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function generateSlots(
  startTime: string,
  endTime: string,
  slotDuration: number,
  breakStart?: string | null,
  breakEnd?: string | null,
): TimeSlot[] {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const bStart = breakStart ? timeToMinutes(breakStart) : null;
  const bEnd = breakEnd ? timeToMinutes(breakEnd) : null;
  const slots: TimeSlot[] = [];

  for (let t = start; t + slotDuration <= end; t += slotDuration) {
    const slotEnd = t + slotDuration;
    if (bStart !== null && bEnd !== null) {
      if (!(slotEnd <= bStart || t >= bEnd)) continue; // overlaps break
    }
    slots.push({ start: minutesToTime(t), end: minutesToTime(slotEnd) });
  }

  return slots;
}

@Injectable()
export class WorkScheduleService {
  constructor(private prisma: PrismaService) {}

  // ── Work Schedules ─────────────────────────────────────────────────────────

  async createSchedule(dto: CreateWorkScheduleDto) {
    const existing = await this.prisma.workSchedule.findUnique({
      where: { providerId_dayOfWeek: { providerId: dto.providerId, dayOfWeek: dto.dayOfWeek } },
    });
    if (existing) throw new BadRequestException(`Schedule for ${dto.dayOfWeek} already exists`);
    return this.prisma.workSchedule.create({ data: dto });
  }

  async getSchedules(providerId: number) {
    return this.prisma.workSchedule.findMany({
      where: { providerId, isActive: true },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async updateSchedule(id: number, dto: UpdateWorkScheduleDto) {
    await this.findScheduleOrFail(id);
    return this.prisma.workSchedule.update({ where: { id }, data: dto });
  }

  async deleteSchedule(id: number) {
    await this.findScheduleOrFail(id);
    return this.prisma.workSchedule.delete({ where: { id } });
  }

  // ── Schedule Exceptions ────────────────────────────────────────────────────

  async createException(dto: CreateExceptionDto) {
    const date = new Date(dto.date);
    const existing = await this.prisma.scheduleException.findUnique({
      where: { providerId_date: { providerId: dto.providerId, date } },
    });
    if (existing) throw new BadRequestException(`Exception for ${dto.date} already exists`);
    return this.prisma.scheduleException.create({ data: { ...dto, date } });
  }

  async getExceptions(providerId: number, startDate?: string, endDate?: string) {
    return this.prisma.scheduleException.findMany({
      where: {
        providerId,
        ...(startDate || endDate
          ? {
              date: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: 'asc' },
    });
  }

  async deleteException(id: number) {
    const ex = await this.prisma.scheduleException.findUnique({ where: { id } });
    if (!ex) throw new NotFoundException('Exception not found');
    return this.prisma.scheduleException.delete({ where: { id } });
  }

  // ── Provider Settings ──────────────────────────────────────────────────────

  async upsertSettings(providerId: number, dto: UpsertProviderSettingsDto) {
    return this.prisma.providerSettings.upsert({
      where: { providerId },
      create: { providerId, ...dto },
      update: dto,
    });
  }

  async getSettings(providerId: number) {
    return this.prisma.providerSettings.findUnique({ where: { providerId } });
  }

  // ── Availability ───────────────────────────────────────────────────────────

  async getAvailability(providerId: number, dateStr: string) {
    const targetDate = new Date(dateStr);
    const dayOfWeek = JS_DAY_TO_ENUM[targetDate.getUTCDay()];

    // 1. Check for exception on this date
    const exception = await this.prisma.scheduleException.findUnique({
      where: { providerId_date: { providerId, date: targetDate } },
    });

    let startTime: string;
    let endTime: string;
    let slotDuration: number;
    let breakStart: string | null = null;
    let breakEnd: string | null = null;

    if (exception) {
      if (
        ([ExceptionType.DAY_OFF, ExceptionType.VACATION, ExceptionType.HOLIDAY] as ExceptionType[]).includes(
          exception.exceptionType,
        )
      ) {
        return {
          isAvailable: false,
          reason: `${exception.exceptionType}: ${exception.reason ?? 'No disponible'}`,
          availableSlots: [],
        };
      }
      // CUSTOM_HOURS
      startTime = exception.startTime!;
      endTime = exception.endTime!;
      slotDuration = exception.slotDurationMinutes ?? 30;
    } else {
      // 2. Use regular weekly schedule
      const schedule = await this.prisma.workSchedule.findUnique({
        where: { providerId_dayOfWeek: { providerId, dayOfWeek } },
      });

      if (!schedule || !schedule.isActive) {
        return {
          isAvailable: false,
          reason: `No hay horario configurado para ${dayOfWeek}`,
          availableSlots: [],
        };
      }

      startTime = schedule.startTime;
      endTime = schedule.endTime;
      slotDuration = schedule.slotDurationMinutes;
      breakStart = schedule.breakStart;
      breakEnd = schedule.breakEnd;
    }

    // 3. Generate slots
    const slots = generateSlots(startTime, endTime, slotDuration, breakStart, breakEnd);

    // 4. Filter occupied slots
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const booked = await this.prisma.appointment.findMany({
      where: {
        providerId,
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
        dateTime: { gte: startOfDay, lte: endOfDay },
      },
    });

    const available = slots.filter((slot) => {
      const slotStart = timeToMinutes(slot.start);
      const slotEnd = timeToMinutes(slot.end);

      return !booked.some((a) => {
        const aStart =
          a.dateTime.getUTCHours() * 60 + a.dateTime.getUTCMinutes();
        const aEnd = aStart + a.durationMinutes;
        return slotStart < aEnd && slotEnd > aStart;
      });
    });

    return {
      isAvailable: available.length > 0,
      reason: available.length > 0 ? 'Slots disponibles' : 'Sin disponibilidad',
      availableSlots: available,
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async findScheduleOrFail(id: number) {
    const s = await this.prisma.workSchedule.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Work schedule not found');
    return s;
  }
}
