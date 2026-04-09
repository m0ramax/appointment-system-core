/**
 * Máquina de estados para el flujo de agendamiento por WhatsApp.
 * Flujo: INICIO → ELIGIENDO_SERVICIO → [ELIGIENDO_PROVIDER] → ELIGIENDO_DIA → ELIGIENDO_HORA → CONFIRMANDO → CONFIRMADO
 */
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { WorkScheduleService } from '../work-schedule/work-schedule.service';

interface StepResult {
  reply: string;
  nextState: string;
  nextContext: Record<string, any>;
}

const AFIRMACIONES = new Set(['si', 'sí', 'yes', 's', '1', 'ok', 'confirmar', 'confirmo']);
const NEGACIONES = new Set(['no', 'n', '0', 'cancelar', 'cancel']);

function parseDate(msg: string): Date | null {
  const s = msg.trim().toLowerCase();
  const today = new Date();

  if (s === 'hoy' || s === 'today') return today;
  if (s === 'mañana' || s === 'manana' || s === 'tomorrow') {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  }

  const fmts = [
    /^(\d{4})-(\d{2})-(\d{2})$/,   // YYYY-MM-DD
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
    /^(\d{2})-(\d{2})-(\d{4})$/,   // DD-MM-YYYY
  ];

  for (const re of fmts) {
    const m = s.match(re);
    if (m) {
      const isYearFirst = re.source.startsWith('^(\\d{4})');
      const [year, month, day] = isYearFirst
        ? [+m[1], +m[2] - 1, +m[3]]
        : [+m[3], +m[2] - 1, +m[1]];
      const d = new Date(Date.UTC(year, month, day));
      if (!isNaN(d.getTime())) return d;
    }
  }

  return null;
}

@Injectable()
export class StateMachineService {
  constructor(
    private prisma: PrismaService,
    private appointments: AppointmentsService,
    private workSchedule: WorkScheduleService,
  ) {}

  async process(
    state: string,
    context: Record<string, any>,
    message: string,
    phone: string,
    toNumber: string,
  ): Promise<StepResult> {
    const msg = message.trim().toLowerCase();
    const ctx = { ...context, phone };

    const currentState = state === 'CONFIRMADO' ? 'INICIO' : state;

    switch (currentState) {
      case 'INICIO':
        return this.handleInicio(ctx, toNumber);
      case 'ELIGIENDO_SERVICIO':
        return this.handleServicio(ctx, msg);
      case 'ELIGIENDO_PROVIDER':
        return this.handleProvider(ctx, msg);
      case 'ELIGIENDO_DIA':
        return this.handleDia(ctx, msg);
      case 'ELIGIENDO_HORA':
        return this.handleHora(ctx, msg);
      case 'CONFIRMANDO':
        return this.handleConfirmando(ctx, msg, phone);
      default:
        return this.handleInicio(ctx, toNumber);
    }
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  private async handleInicio(ctx: Record<string, any>, toNumber: string): Promise<StepResult> {
    const business = await this.prisma.business.findUnique({
      where: { whatsappNumber: toNumber },
      include: { services: { where: { isActive: true }, orderBy: { name: 'asc' } } },
    });

    if (!business) {
      return {
        reply: 'Lo sentimos, el sistema de agendamiento no está disponible.',
        nextState: 'INICIO',
        nextContext: {},
      };
    }

    if (!business.services.length) {
      return {
        reply: 'Lo sentimos, no hay servicios disponibles en este momento.',
        nextState: 'INICIO',
        nextContext: {},
      };
    }

    const menu = business.services.map((s, i) => `${i + 1}. ${s.name}`).join('\n');
    return {
      reply: `Hola! Bienvenido a ${business.name}.\n\n¿Qué tipo de cita necesitas?\n${menu}\n\nResponde con el número o el nombre.`,
      nextState: 'ELIGIENDO_SERVICIO',
      nextContext: {
        phone: ctx.phone,
        business_id: business.id,
        business_name: business.name,
        allow_provider_selection: business.allowProviderSelection,
        services: business.services.map((s) => ({ id: s.id, name: s.name, duration: s.durationMinutes })),
      },
    };
  }

  private async handleServicio(ctx: Record<string, any>, msg: string): Promise<StepResult> {
    const services: { id: number; name: string; duration: number }[] = ctx.services ?? [];

    let service: { id: number; name: string; duration: number } | undefined =
      services[parseInt(msg) - 1];
    if (!service) {
      service = services.find(
        (s) => s.name.toLowerCase().includes(msg) || msg.includes(s.name.toLowerCase()),
      );
    }

    if (!service) {
      const menu = services.map((s, i) => `${i + 1}. ${s.name}`).join('\n');
      return { reply: `No reconocí esa opción. Elige:\n${menu}`, nextState: 'ELIGIENDO_SERVICIO', nextContext: ctx };
    }

    const nextCtx = { ...ctx, service_id: service.id, servicio: service.name, duracion: service.duration };

    if (ctx.allow_provider_selection) {
      return this.showProviderSelection(nextCtx);
    }

    return this.askForDate(nextCtx);
  }

  private async showProviderSelection(ctx: Record<string, any>): Promise<StepResult> {
    const providers = await this.prisma.user.findMany({
      where: {
        businessId: ctx.business_id,
        role: { in: [UserRole.PROVIDER, UserRole.OWNER] },
      },
      select: { id: true, email: true },
    });

    if (!providers.length) {
      return {
        reply: 'No hay proveedores disponibles. Intenta más tarde.',
        nextState: 'INICIO',
        nextContext: {},
      };
    }

    const menu = providers.map((p, i) => `${i + 1}. ${p.email}`).join('\n');
    return {
      reply: `¿Con quién deseas agendar?\n${menu}\n\nResponde con el número.`,
      nextState: 'ELIGIENDO_PROVIDER',
      nextContext: {
        ...ctx,
        providers: providers.map((p) => ({ id: p.id, email: p.email })),
      },
    };
  }

  private async handleProvider(ctx: Record<string, any>, msg: string): Promise<StepResult> {
    const providers: { id: number; email: string }[] = ctx.providers ?? [];
    const idx = parseInt(msg.trim());
    const provider = providers[idx - 1];

    if (!provider) {
      const menu = providers.map((p, i) => `${i + 1}. ${p.email}`).join('\n');
      return { reply: `No reconocí esa opción. Elige:\n${menu}`, nextState: 'ELIGIENDO_PROVIDER', nextContext: ctx };
    }

    return this.askForDate({ ...ctx, provider_id: provider.id });
  }

  private askForDate(ctx: Record<string, any>): StepResult {
    return {
      reply: `Perfecto, ${ctx.servicio}.\n\n¿Para qué fecha?\n- hoy / mañana\n- DD/MM/YYYY (ej: 15/04/2026)\n- YYYY-MM-DD (ej: 2026-04-15)`,
      nextState: 'ELIGIENDO_DIA',
      nextContext: ctx,
    };
  }

  private async handleDia(ctx: Record<string, any>, msg: string): Promise<StepResult> {
    const date = parseDate(msg);

    if (!date) {
      return {
        reply: 'No pude interpretar la fecha. Intenta con DD/MM/YYYY, YYYY-MM-DD o escribe hoy / mañana.',
        nextState: 'ELIGIENDO_DIA',
        nextContext: ctx,
      };
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (date < today) {
      return { reply: 'No se puede agendar en fechas pasadas. ¿Qué otra fecha?', nextState: 'ELIGIENDO_DIA', nextContext: ctx };
    }

    const dateStr = date.toISOString().split('T')[0];

    // Si no se eligió provider, buscar el primero disponible del negocio
    if (!ctx.provider_id) {
      const result = await this.findFirstAvailableProvider(ctx.business_id, dateStr, ctx.duracion);
      if (!result) {
        return {
          reply: `Sin disponibilidad el ${dateStr}. ¿Tienes otra fecha?`,
          nextState: 'ELIGIENDO_DIA',
          nextContext: ctx,
        };
      }
      const { providerId, slots } = result;
      const menu = slots.map((s, i) => `${i + 1}. ${s}`).join('\n');
      return {
        reply: `Horarios disponibles para el ${dateStr}:\n\n${menu}\n\nResponde con el número o la hora (ej: 09:30).`,
        nextState: 'ELIGIENDO_HORA',
        nextContext: { ...ctx, dia: dateStr, slots, provider_id: providerId },
      };
    }

    const availability = await this.workSchedule.getAvailability(ctx.provider_id, dateStr);

    if (!availability.isAvailable || !availability.availableSlots.length) {
      return {
        reply: `Sin disponibilidad el ${dateStr} (${availability.reason}). ¿Tienes otra fecha?`,
        nextState: 'ELIGIENDO_DIA',
        nextContext: ctx,
      };
    }

    const slots: string[] = availability.availableSlots.map((s: any) => s.start);
    const menu = slots.map((s, i) => `${i + 1}. ${s}`).join('\n');

    return {
      reply: `Horarios disponibles para el ${dateStr}:\n\n${menu}\n\nResponde con el número o la hora (ej: 09:30).`,
      nextState: 'ELIGIENDO_HORA',
      nextContext: { ...ctx, dia: dateStr, slots },
    };
  }

  private async handleHora(ctx: Record<string, any>, msg: string): Promise<StepResult> {
    const slots: string[] = ctx.slots ?? [];
    let hora: string | undefined;

    const idx = parseInt(msg.trim());
    if (!isNaN(idx) && idx >= 1 && idx <= slots.length) {
      hora = slots[idx - 1];
    } else {
      const normalized = msg.trim().length === 4 ? '0' + msg.trim() : msg.trim();
      hora = slots.find((s) => s === normalized);
    }

    if (!hora) {
      const menu = slots.map((s, i) => `${i + 1}. ${s}`).join('\n');
      return { reply: `No reconocí esa selección. Elige:\n${menu}`, nextState: 'ELIGIENDO_HORA', nextContext: ctx };
    }

    return {
      reply:
        `Resumen de tu cita:\n` +
        `- Servicio: ${ctx.servicio}\n` +
        `- Fecha: ${ctx.dia}\n` +
        `- Hora: ${hora}\n\n` +
        `¿Confirmas? Responde SI o NO.`,
      nextState: 'CONFIRMANDO',
      nextContext: { ...ctx, hora },
    };
  }

  private async handleConfirmando(
    ctx: Record<string, any>,
    msg: string,
    phone: string,
  ): Promise<StepResult> {
    if (NEGACIONES.has(msg)) {
      return { reply: 'Cita cancelada. Escribe cualquier mensaje para empezar de nuevo.', nextState: 'CONFIRMADO', nextContext: {} };
    }

    if (!AFIRMACIONES.has(msg)) {
      return { reply: 'No entendí. Escribe SI para confirmar o NO para cancelar.', nextState: 'CONFIRMANDO', nextContext: ctx };
    }

    const client = await this.getOrCreateGuestClient(phone);

    try {
      const dateTime = new Date(`${ctx.dia}T${ctx.hora}:00.000Z`);
      await this.appointments.checkOverlap(ctx.provider_id, dateTime, ctx.duracion);
      await this.prisma.appointment.create({
        data: {
          title: ctx.servicio,
          description: 'Agendado por WhatsApp',
          dateTime,
          durationMinutes: ctx.duracion,
          providerId: ctx.provider_id,
          clientId: client.id,
          businessId: ctx.business_id,
          serviceId: ctx.service_id,
        },
      });
    } catch (e: any) {
      return {
        reply: `Error al crear la cita: ${e.message}. Escribe cualquier mensaje para intentarlo de nuevo.`,
        nextState: 'CONFIRMADO',
        nextContext: {},
      };
    }

    return {
      reply:
        `¡Cita confirmada!\n\n` +
        `Servicio: ${ctx.servicio}\n` +
        `Fecha: ${ctx.dia}\n` +
        `Hora: ${ctx.hora}\n\n` +
        `Te esperamos. Para cancelar contáctanos.`,
      nextState: 'CONFIRMADO',
      nextContext: {},
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async findFirstAvailableProvider(
    businessId: number,
    dateStr: string,
    duration: number,
  ): Promise<{ providerId: number; slots: string[] } | null> {
    const providers = await this.prisma.user.findMany({
      where: {
        businessId,
        role: { in: [UserRole.PROVIDER, UserRole.OWNER] },
      },
      select: { id: true },
    });

    for (const provider of providers) {
      const availability = await this.workSchedule.getAvailability(provider.id, dateStr);
      if (availability.isAvailable && availability.availableSlots.length) {
        return {
          providerId: provider.id,
          slots: availability.availableSlots.map((s: any) => s.start),
        };
      }
    }

    return null;
  }

  private async getOrCreateGuestClient(phone: string) {
    const clean = phone.replace(/\D/g, '');
    const email = `${clean}@whatsapp.guest`;
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) return existing;

    return this.prisma.user.create({
      data: {
        email,
        hashedPassword: await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10),
        role: UserRole.CLIENT,
      },
    });
  }
}
