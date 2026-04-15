import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InviteService {
  constructor(private prisma: PrismaService) {}

  async create(note?: string) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    return this.prisma.inviteToken.create({
      data: { note, expiresAt },
    });
  }

  async findAll() {
    return this.prisma.inviteToken.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async validate(token: string) {
    const invite = await this.prisma.inviteToken.findUnique({ where: { token } });
    if (!invite) throw new BadRequestException('Invitación inválida');
    if (invite.used) throw new BadRequestException('Esta invitación ya fue utilizada');
    if (invite.expiresAt < new Date()) throw new BadRequestException('Esta invitación ha expirado');
    return invite;
  }

  async markUsed(token: string, businessId: number) {
    return this.prisma.inviteToken.update({
      where: { token },
      data: { used: true, usedByBusinessId: businessId },
    });
  }

  async revoke(id: number) {
    return this.prisma.inviteToken.update({
      where: { id },
      data: { used: true },
    });
  }

  async getStats() {
    const [businesses, appointments, invites] = await Promise.all([
      this.prisma.business.count(),
      this.prisma.appointment.count(),
      this.prisma.inviteToken.count({ where: { used: false, expiresAt: { gt: new Date() } } }),
    ]);
    return { businesses, appointments, activeInvites: invites };
  }
}
