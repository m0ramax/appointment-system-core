import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateServiceDto, businessId: number) {
    return this.prisma.service.create({ data: { ...dto, businessId } });
  }

  async findByBusiness(businessId: number) {
    return this.prisma.service.findMany({
      where: { businessId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async update(id: number, dto: UpdateServiceDto, businessId: number) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) throw new NotFoundException('Servicio no encontrado');
    if (service.businessId !== businessId) throw new ForbiddenException();
    return this.prisma.service.update({ where: { id }, data: dto });
  }

  async remove(id: number, businessId: number) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) throw new NotFoundException('Servicio no encontrado');
    if (service.businessId !== businessId) throw new ForbiddenException();
    return this.prisma.service.delete({ where: { id } });
  }
}
