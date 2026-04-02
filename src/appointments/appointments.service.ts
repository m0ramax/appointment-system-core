import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

export interface AuthUser {
  id: number;
  role: UserRole;
}

const VALID_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  [AppointmentStatus.PENDING]: [AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED],
  [AppointmentStatus.CONFIRMED]: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED],
  [AppointmentStatus.CANCELLED]: [],
  [AppointmentStatus.COMPLETED]: [],
};

@Injectable()
export class AppointmentsService {
  constructor(private prisma: PrismaService) {}

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
    const where = user.role === UserRole.CLIENT ? { clientId: user.id } : { providerId: user.id };
    return this.prisma.appointment.findMany({ where, orderBy: { dateTime: 'asc' } });
  }

  async findOne(id: number, user: AuthUser) {
    const appt = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appt) throw new NotFoundException('Appointment not found');
    if (appt.clientId !== user.id && appt.providerId !== user.id) throw new ForbiddenException();
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
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
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

  private validateTransition(current: AppointmentStatus, next: AppointmentStatus, role: UserRole) {
    if (!VALID_TRANSITIONS[current].includes(next)) {
      throw new BadRequestException(`Invalid transition from ${current} to ${next}`);
    }
    const providerOnly: AppointmentStatus[] = [AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED];
    if (providerOnly.includes(next) && role !== UserRole.PROVIDER) {
      throw new ForbiddenException(`Only providers can set status to ${next}`);
    }
  }
}
