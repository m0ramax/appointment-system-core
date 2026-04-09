import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';

@Injectable()
export class BusinessService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateBusinessDto, ownerId: number) {
    const existing = await this.prisma.business.findUnique({
      where: { whatsappNumber: dto.whatsappNumber },
    });
    if (existing) throw new ConflictException('WhatsApp number already registered');

    const business = await this.prisma.business.create({ data: dto });

    await this.prisma.user.update({
      where: { id: ownerId },
      data: { businessId: business.id },
    });

    return business;
  }

  async findAll() {
    return this.prisma.business.findMany({ include: { services: true } });
  }

  async findOne(id: number) {
    const business = await this.prisma.business.findUnique({
      where: { id },
      include: { services: { where: { isActive: true } } },
    });
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }

  async update(id: number, dto: UpdateBusinessDto) {
    await this.findOne(id);
    return this.prisma.business.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.business.delete({ where: { id } });
  }
}
