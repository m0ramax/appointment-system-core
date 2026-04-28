import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateAdminBusinessDto } from './dto/update-admin-business.dto';

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  businessId: true,
};

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async findAllBusinesses() {
    return this.prisma.business.findMany({
      include: {
        users: {
          where: { role: 'OWNER' },
          select: { email: true },
          take: 1,
        },
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

  async updateBusiness(id: number, dto: UpdateAdminBusinessDto) {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) throw new NotFoundException('Negocio no encontrado');

    if (dto.whatsappNumber && dto.whatsappNumber !== business.whatsappNumber) {
      const conflict = await this.prisma.business.findFirst({
        where: { whatsappNumber: dto.whatsappNumber, NOT: { id } },
      });
      if (conflict) throw new ConflictException('El número de WhatsApp ya está en uso');
    }

    return this.prisma.business.update({
      where: { id },
      data: dto,
      include: { _count: { select: { users: true, services: true, appointments: true } } },
    });
  }

  async findAllUsers() {
    return this.prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { id: 'asc' },
    });
  }

  async updateUser(id: number, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (dto.email && dto.email !== user.email) {
      const conflict = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id } },
      });
      if (conflict) throw new ConflictException('El email ya está en uso');
    }

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: USER_SELECT,
    });
  }
}
