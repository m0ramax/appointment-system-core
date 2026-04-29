import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { UpdateWhatsappNumberDto } from './dto/update-whatsapp-number.dto';
import { UpdateWhatsappConfigDto } from './dto/update-whatsapp-config.dto';
import { InviteService } from '../invite/invite.service';

@Injectable()
export class BusinessService {
  constructor(
    private prisma: PrismaService,
    private invite: InviteService,
  ) {}

  async create(dto: CreateBusinessDto, ownerId: number, inviteToken?: string) {
    const existing = await this.prisma.business.findUnique({
      where: { whatsappNumber: dto.whatsappNumber },
    });
    if (existing) throw new ConflictException('El número de WhatsApp ya está registrado');

    const business = await this.prisma.business.create({ data: dto });

    await this.prisma.user.update({
      where: { id: ownerId },
      data: { businessId: business.id },
    });

    if (inviteToken) {
      await this.invite.markUsed(inviteToken, business.id);
    }

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
    if (!business) throw new NotFoundException('Negocio no encontrado');
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

  async getTeam(businessId: number | null) {
    if (businessId === null) return [];
    return this.prisma.user.findMany({
      where: {
        businessId,
        role: { in: ['PROVIDER', 'OWNER'] },
      },
      select: { id: true, email: true, role: true },
      orderBy: { id: 'asc' },
    });
  }

  async updateWhatsappNumber(businessId: number, dto: UpdateWhatsappNumberDto) {
    const conflict = await this.prisma.business.findUnique({
      where: { whatsappNumber: dto.whatsappNumber },
    });
    if (conflict && conflict.id !== businessId) {
      throw new ConflictException('El número de WhatsApp ya está en uso por otro negocio');
    }

    return this.prisma.business.update({
      where: { id: businessId },
      data: { whatsappNumber: dto.whatsappNumber },
    });
  }

  async updateWhatsappConfig(businessId: number, dto: UpdateWhatsappConfigDto) {
    if (dto.slug) {
      const conflict = await this.prisma.business.findUnique({ where: { slug: dto.slug } });
      if (conflict && conflict.id !== businessId) {
        throw new ConflictException('El slug ya está en uso por otro negocio');
      }
    }
    return this.prisma.business.update({ where: { id: businessId }, data: dto });
  }

  async findBySlug(slug: string) {
    const business = await this.prisma.business.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        whatsappWelcome: true,
        whatsappConfirmation: true,
        whatsappCancellation: true,
        appointmentDuration: true,
        timezone: true,
        allowProviderSelection: true,
        teamMode: true,
      },
    });
    if (!business) throw new NotFoundException('Negocio no encontrado');
    return business;
  }

  async getBotStatus(businessId: number) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { whatsappNumber: true },
    });
    if (!business) throw new NotFoundException('Negocio no encontrado');

    const rows = await this.prisma.$queryRaw<{ last: Date | null }[]>`
      SELECT MAX("updatedAt") as last
      FROM "ConversationState"
      WHERE context->>'business_id' = ${String(businessId)}
    `;

    const lastActivity =
      rows[0]?.last != null ? (rows[0].last as Date).toISOString() : null;

    return {
      whatsappNumber: business.whatsappNumber,
      configured: !!business.whatsappNumber,
      lastActivity,
    };
  }
}
