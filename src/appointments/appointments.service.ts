import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { WorkScheduleService } from '../work-schedule/work-schedule.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { CreateManualAppointmentDto } from './dto/create-manual-appointment.dto';

export interface AuthUser {
  id: number;
  role: UserRole;
}

const VALID_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  [AppointmentStatus.PENDING]: [
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.CANCELLED,
  ],
  [AppointmentStatus.CONFIRMED]: [
    AppointmentStatus.COMPLETED,
    AppointmentStatus.CANCELLED,
  ],
  [AppointmentStatus.CANCELLED]: [],
  [AppointmentStatus.COMPLETED]: [],
};

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private workSchedule: WorkScheduleService,
  ) {}

  async create(dto: CreateAppointmentDto, clientId: number) {
    const provider = await this.prisma.user.findFirst({
      where: { id: dto.providerId, role: UserRole.PROVIDER },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    const dateTime = new Date(dto.dateTime);
    if (dateTime <= new Date()) {
      throw new BadRequestException('Cannot create appointments in the past');
    }

    await this.checkOverlap(dto.providerId, dateTime, dto.durationMinutes);
    await this.checkWithinSchedule(dto.providerId, dateTime, dto.durationMinutes);

    return this.prisma.appointment.create({
      data: {
        title: dto.title,
        description: dto.description,
        dateTime,
        durationMinutes: dto.durationMinutes,
        providerId: dto.providerId,
        clientId,
        status: AppointmentStatus.PENDING,
      },
    });
  }

  async findMine(user: AuthUser) {
    const isProvider = user.role === UserRole.PROVIDER || user.role === UserRole.OWNER;
    const where = isProvider ? { providerId: user.id } : { clientId: user.id };
    return this.prisma.appointment.findMany({
      where,
      orderBy: { dateTime: 'asc' },
      include: isProvider
        ? { client: { select: { id: true, email: true } } }
        : undefined,
    });
  }

  async findOne(id: number, user: AuthUser) {
    const appt = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appt) throw new NotFoundException('Appointment not found');
    if (appt.clientId !== user.id && appt.providerId !== user.id)
      throw new ForbiddenException();
    return appt;
  }

  async update(id: number, dto: UpdateAppointmentDto, user: AuthUser) {
    const appt = await this.findOne(id, user);
    if (dto.status) this.validateTransition(appt.status, dto.status, user.role);
    return this.prisma.appointment.update({ where: { id }, data: dto });
  }

  async remove(id: number, user: AuthUser) {
    const appt = await this.findOne(id, user);
    if (appt.status !== AppointmentStatus.PENDING) {
      throw new BadRequestException('Only pending appointments can be deleted');
    }
    return this.prisma.appointment.delete({ where: { id } });
  }

  async findByBusiness(
    businessId: number,
    date?: string,
    startDate?: string,
    endDate?: string,
  ) {
    let rangeStart: Date;
    let rangeEnd: Date;

    if (startDate && endDate) {
      rangeStart = new Date(startDate);
      rangeStart.setUTCHours(0, 0, 0, 0);
      rangeEnd = new Date(endDate);
      rangeEnd.setUTCHours(23, 59, 59, 999);
    } else {
      const targetDate = new Date(date ?? new Date().toISOString().split('T')[0]);
      rangeStart = new Date(targetDate);
      rangeStart.setUTCHours(0, 0, 0, 0);
      rangeEnd = new Date(targetDate);
      rangeEnd.setUTCHours(23, 59, 59, 999);
    }

    return this.prisma.appointment.findMany({
      where: {
        provider: { businessId },
        dateTime: { gte: rangeStart, lte: rangeEnd },
        status: { notIn: [AppointmentStatus.CANCELLED] },
      },
      include: {
        client: { select: { id: true, email: true } },
        provider: { select: { id: true, email: true } },
      },
      orderBy: { dateTime: 'asc' },
    });
  }

  async createManual(dto: CreateManualAppointmentDto, businessId: number) {
    // Find or create client by email
    let client = await this.prisma.user.findUnique({ where: { email: dto.clientEmail } });
    if (!client) {
      const hashedPassword = await bcrypt.hash(Math.random().toString(36), 10);
      client = await this.prisma.user.create({
        data: { email: dto.clientEmail, hashedPassword, role: UserRole.CLIENT, businessId: null },
      });
    }

    // Validate provider belongs to the business
    const provider = await this.prisma.user.findFirst({
      where: { id: dto.providerId, businessId },
    });
    if (!provider) throw new NotFoundException('Provider not found in this business');

    const dateTime = new Date(dto.dateTime);
    await this.checkOverlap(dto.providerId, dateTime, dto.durationMinutes);

    return this.prisma.appointment.create({
      data: {
        title: dto.title,
        description: dto.description,
        dateTime,
        durationMinutes: dto.durationMinutes,
        providerId: dto.providerId,
        clientId: client.id,
        serviceId: dto.serviceId,
        status: AppointmentStatus.CONFIRMED,
      },
      include: { client: { select: { id: true, email: true } } },
    });
  }

  async getProviders() {
    return this.prisma.user.findMany({
      where: { role: UserRole.PROVIDER },
      select: { id: true, email: true },
    });
  }

  async checkOverlap(
    providerId: number,
    dateTime: Date,
    durationMinutes: number,
    excludeId?: number,
  ) {
    const end = new Date(dateTime.getTime() + durationMinutes * 60_000);
    const startOfDay = new Date(dateTime);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(dateTime);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const existing = await this.prisma.appointment.findMany({
      where: {
        providerId,
        status: {
          in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
        },
        dateTime: { gte: startOfDay, lte: endOfDay },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    for (const a of existing) {
      const aEnd = new Date(a.dateTime.getTime() + a.durationMinutes * 60_000);
      if (dateTime < aEnd && end > a.dateTime) {
        throw new BadRequestException(
          `Time slot conflicts with existing appointment "${a.title}"`,
        );
      }
    }
  }

  private async checkWithinSchedule(
    providerId: number,
    dateTime: Date,
    durationMinutes: number,
  ) {
    const dateStr = dateTime.toISOString().split('T')[0];
    const availability = await this.workSchedule.getAvailability(providerId, dateStr);

    if (!availability.isAvailable) {
      throw new BadRequestException(
        `Provider is not available on this date: ${availability.reason}`,
      );
    }

    const apptStart = dateTime.getUTCHours() * 60 + dateTime.getUTCMinutes();
    const apptEnd = apptStart + durationMinutes;

    const withinSlot = availability.availableSlots.some((slot: { start: string; end: string }) => {
      const [sh, sm] = slot.start.split(':').map(Number);
      const [eh, em] = slot.end.split(':').map(Number);
      const slotStart = sh * 60 + sm;
      const slotEnd = eh * 60 + em;
      return apptStart >= slotStart && apptEnd <= slotEnd;
    });

    if (!withinSlot) {
      throw new BadRequestException(
        'Requested time is outside the provider\'s working hours',
      );
    }
  }

  private validateTransition(
    current: AppointmentStatus,
    next: AppointmentStatus,
    role: UserRole,
  ) {
    if (!VALID_TRANSITIONS[current].includes(next)) {
      throw new BadRequestException(
        `Invalid transition from ${current} to ${next}`,
      );
    }
    const providerOnly: AppointmentStatus[] = [
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.COMPLETED,
    ];
    if (providerOnly.includes(next) && role !== UserRole.PROVIDER) {
      throw new ForbiddenException(`Only providers can set status to ${next}`);
    }
  }
}
