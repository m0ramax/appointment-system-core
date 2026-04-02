/**
 * Máquina de estados para el flujo de agendamiento por WhatsApp.
 * Flujo: INICIO → ELIGIENDO_SERVICIO → ELIGIENDO_DIA → ELIGIENDO_HORA → CONFIRMANDO → CONFIRMADO
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

const SERVICIOS = [
  { id: 1, nombre: 'Consulta General', duracion: 30 },
  { id: 2, nombre: 'Consulta de Seguimiento', duracion: 30 },
  { id: 3, nombre: 'Revisión', duracion: 30 },
];

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
  ): Promise<StepResult> {
    const msg = message.trim().toLowerCase();
    const ctx = { ...context, phone };

    // Reiniciar si ya terminó
    const currentState = state === 'CONFIRMADO' ? 'INICIO' : state;

    switch (currentState) {
      case 'INICIO':
        return this.handleInicio(ctx);
      case 'ELIGIENDO_SERVICIO':
        return this.handleServicio(ctx, msg);
      case 'ELIGIENDO_DIA':
        return this.handleDia(ctx, msg);
      case 'ELIGIENDO_HORA':
        return this.handleHora(ctx, msg);
      case 'CONFIRMANDO':
        return this.handleConfirmando(ctx, msg, phone);
      default:
        return this.handleInicio(ctx);
    }
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  private async handleInicio(ctx: Record<string, any>): Promise<StepResult> {
    const provider = await this.prisma.user.findFirst({ where: { role: UserRole.PROVIDER } });
    if (!provider) {
      return {
        reply: 'Lo sentimos, el sistema de agendamiento no está disponible.',
        nextState: 'INICIO',
        nextContext: {},
      };
    }

    const menu = SERVICIOS.map((s) => `${s.id}. ${s.nombre}`).join('\n');
    return {
      reply: `Hola! Bienvenido al sistema de agendamiento.\n\n¿Qué tipo de cita necesitas?\n${menu}\n\nResponde con el número o el nombre.`,
      nextState: 'ELIGIENDO_SERVICIO',
      nextContext: { provider_id: provider.id, phone: ctx.phone },
    };
  }

  private async handleServicio(ctx: Record<string, any>, msg: string): Promise<StepResult> {
    let servicio = SERVICIOS.find((s) => s.id === parseInt(msg));
    if (!servicio) {
      servicio = SERVICIOS.find((s) => s.nombre.toLowerCase().includes(msg) || msg.includes(s.nombre.toLowerCase()));
    }

    if (!servicio) {
      const menu = SERVICIOS.map((s) => `${s.id}. ${s.nombre}`).join('\n');
      return { reply: `No reconocí esa opción. Elige:\n${menu}`, nextState: 'ELIGIENDO_SERVICIO', nextContext: ctx };
    }

    return {
      reply: `Perfecto, ${servicio.nombre}.\n\n¿Para qué fecha?\n- hoy / mañana\n- DD/MM/YYYY (ej: 15/04/2026)\n- YYYY-MM-DD (ej: 2026-04-15)`,
      nextState: 'ELIGIENDO_DIA',
      nextContext: { ...ctx, servicio: servicio.nombre, duracion: servicio.duracion },
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
