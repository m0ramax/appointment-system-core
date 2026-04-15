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
  businessId?: number | null;
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
    if (!provider) throw new NotFoundException('Proveedor no encontrado');

    const dateTime = new Date(dto.dateTime);
    if (dateTime <= new Date()) {
      throw new BadRequestException('No se pueden crear citas en el pasado');
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
    if (!appt) throw new NotFoundException('Cita no encontrada');
    if (user.role === UserRole.OWNER) {
      // Owner can access any appointment whose provider belongs to their business
      const provider = await this.prisma.user.findUnique({
        where: { id: appt.providerId },
        select: { businessId: true },
      });
      if (!provider || provider.businessId !== user.businessId)
        throw new ForbiddenException();
    } else {
      if (appt.clientId !== user.id && appt.providerId !== user.id)
        throw new ForbiddenException();
    }
    return appt;
  }

  async update(id: number, dto: UpdateAppointmentDto, user: AuthUser) {
    const appt = await this.findOne(id, user);
    if (dto.status) this.validateTransition(appt.status, dto.status, user.role);
    return this.prisma.appointment.update({ where: { id }, data: dto });
  }

  async remove(id: number, user: AuthUser) {
    const appt = await this.findOne(id, user);
    // Owners can delete any appointment; others can only delete PENDING
    if (user.role !== UserRole.OWNER && appt.status !== AppointmentStatus.PENDING) {
      throw new BadRequestException('Solo se pueden eliminar citas pendientes');
    }
    return this.prisma.appointment.delete({ where: { id } });
  }

  async findByBusiness(
    businessId: number,
    date?: string,
    startDate?: string,
    endDate?: string,
    all?: boolean,
  ) {
    const dateFilter: { gte?: Date; lte?: Date } = {};

    if (!all) {
      if (startDate && endDate) {
        const rangeStart = new Date(startDate);
        rangeStart.setUTCHours(0, 0, 0, 0);
        const rangeEnd = new Date(endDate);
        rangeEnd.setUTCHours(23, 59, 59, 999);
        dateFilter.gte = rangeStart;
        dateFilter.lte = rangeEnd;
      } else {
        const targetDate = new Date(date ?? new Date().toISOString().split('T')[0]);
        const rangeStart = new Date(targetDate);
        rangeStart.setUTCHours(0, 0, 0, 0);
        const rangeEnd = new Date(targetDate);
        rangeEnd.setUTCHours(23, 59, 59, 999);
        dateFilter.gte = rangeStart;
        dateFilter.lte = rangeEnd;
      }
    }

    return this.prisma.appointment.findMany({
      where: {
        provider: { businessId },
        ...(Object.keys(dateFilter).length > 0 ? { dateTime: dateFilter } : {}),
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
    if (!provider) throw new NotFoundException('Proveedor no encontrado en este negocio');

    const dateTime = new Date(dto.dateTime);
    if (dateTime <= new Date()) {
      throw new BadRequestException('No se pueden crear citas en el pasado');
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
          `El horario conflicta con una cita existente: "${a.title}"`,
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
        `El proveedor no está disponible en esta fecha: ${availability.reason}`,
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
        'El horario solicitado está fuera del horario de trabajo del proveedor',
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
        `Transición de estado inválida: de ${current} a ${next}`,
      );
    }
    const providerOrOwnerOnly: AppointmentStatus[] = [
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.COMPLETED,
    ];
    if (
      providerOrOwnerOnly.includes(next) &&
      role !== UserRole.PROVIDER &&
      role !== UserRole.OWNER
    ) {
      throw new ForbiddenException(`Solo proveedores o admins pueden establecer el estado a ${next}`);
    }
  }
}
