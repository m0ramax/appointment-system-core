import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async findAllBusinesses() {
    return this.prisma.business.findMany({
      include: {
        _count: {
          select: { users: true, services: true, appointments: true },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  async toggleSuspend(id: number, suspended: boolean) {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) throw new NotFoundException('Negocio no encontrado');
    return this.prisma.business.update({
      where: { id },
      data: { suspended },
      include: { _count: { select: { users: true, services: true, appointments: true } } },
    });
  }

  async setTeamMode(id: number, teamMode: boolean) {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) throw new NotFoundException('Negocio no encontrado');
    return this.prisma.business.update({
      where: { id },
      data: { teamMode },
      include: { _count: { select: { users: true, services: true, appointments: true } } },
    });
  }

  async deleteBusiness(id: number) {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) throw new NotFoundException('Negocio no encontrado');
    return this.prisma.business.delete({ where: { id } });
  }
}
