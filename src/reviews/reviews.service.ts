import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateLinkDto } from './dto/generate-link.dto';
import { SubmitReviewDto } from './dto/submit-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async generateLink(businessId: number, dto: GenerateLinkDto) {
    const [appointment, business] = await Promise.all([
      this.prisma.appointment.findUnique({ where: { id: dto.appointmentId } }),
      this.prisma.business.findUnique({ where: { id: businessId }, select: { slug: true } }),
    ]);

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada.');
    }

    if (appointment.businessId !== businessId) {
      throw new ForbiddenException('La cita no pertenece a tu negocio.');
    }

    const allowed: AppointmentStatus[] = [AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED];
    if (!allowed.includes(appointment.status)) {
      throw new BadRequestException('Solo se puede generar un link para citas confirmadas o completadas.');
    }

    const slug = business?.slug ?? null;

    const existing = await this.prisma.review.findUnique({
      where: { appointmentId: dto.appointmentId },
    });
    if (existing) {
      const link = this.buildLink(slug, existing.token);
      return { link, token: existing.token };
    }

    const review = await this.prisma.review.create({
      data: { businessId, appointmentId: dto.appointmentId },
    });

    return { link: this.buildLink(slug, review.token), token: review.token };
  }

  async submitReview(token: string, dto: SubmitReviewDto) {
    const review = await this.prisma.review.findUnique({ where: { token } });

    if (!review) {
      throw new NotFoundException('Token de valoración inválido.');
    }

    if (review.rating !== null) {
      throw new BadRequestException('Esta valoración ya fue enviada.');
    }

    return this.prisma.review.update({
      where: { token },
      data: { rating: dto.rating, comment: dto.comment ?? null, clientName: dto.clientName },
      select: { id: true, rating: true, comment: true, clientName: true, createdAt: true },
    });
  }

  async getBySlug(slug: string) {
    const business = await this.prisma.business.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });

    if (!business) {
      throw new NotFoundException('Negocio no encontrado.');
    }

    const reviews = await this.prisma.review.findMany({
      where: { businessId: business.id, rating: { not: null } },
      select: { clientName: true, rating: true, comment: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const total = reviews.length;
    const average = total
      ? Math.round((reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / total) * 10) / 10
      : null;

    return { businessName: business.name, average, total, reviews };
  }

  private buildLink(slug: string | null, token: string): string {
    const base = 'https://tucita.com';
    return slug ? `${base}/${slug}/review?token=${token}` : `${base}/review?token=${token}`;
  }
}
