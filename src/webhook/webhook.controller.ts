import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  HttpCode,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StateMachineService } from './state-machine.service';
import Twilio from 'twilio';

@ApiTags('webhook')
@Controller('webhook')
export class WebhookController {
  private readonly verifyToken: string;
  private readonly twilioClient: ReturnType<typeof Twilio> | null;
  private readonly twilioFrom: string;
  private readonly metaToken: string | null;
  private readonly metaPhoneNumberId: string | null;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private stateMachine: StateMachineService,
  ) {
    this.verifyToken = this.config.get<string>(
      'WHATSAPP_VERIFY_TOKEN',
      'tucita_verify_token',
    );

    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    this.twilioFrom = this.config.get<string>('TWILIO_WHATSAPP_FROM', 'whatsapp:+14155238886');
    this.twilioClient = accountSid && authToken ? Twilio(accountSid, authToken) : null;

    this.metaToken = this.config.get<string>('WHATSAPP_ACCESS_TOKEN') ?? null;
    this.metaPhoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID') ?? null;
  }

  private async sendMetaMessage(to: string, text: string): Promise<void> {
    if (!this.metaToken || !this.metaPhoneNumberId) {
      console.warn('[webhook] sendMetaMessage skipped: missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID');
      return;
    }
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${this.metaPhoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.metaToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(`[webhook] Meta API error ${res.status}: ${body}`);
    }
  }

  /** Meta WhatsApp Cloud API verification */
  @Get('whatsapp')
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    if (mode === 'subscribe' && token === this.verifyToken) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  /** Incoming WhatsApp messages — Twilio or Meta format */
  @Post('whatsapp')
  @HttpCode(200)
  async receive(@Req() req: Request, @Res() res: Response) {
    const contentType = req.headers['content-type'] ?? '';
    let phone = '';
    let toNumber = '';
    let message = '';
    let isTwilio = false;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      // Twilio
      const body = req.body as Record<string, string>;
      phone = (body['From'] ?? '').replace('whatsapp:', '').trim();
      toNumber = (body['To'] ?? '').replace('whatsapp:', '').trim();
      message = (body['Body'] ?? '').trim();
      isTwilio = true;
    } else {
      // Meta
      const body = req.body as any;
      if (body?.object !== 'whatsapp_business_account') {
        return res.json({ status: 'ok' });
      }
      try {
        const change = body.entry[0].changes[0].value;
        const msg = change.messages[0];
        if (msg.type !== 'text') return res.json({ status: 'ok' });
        phone = msg.from;
        const raw = change.metadata?.display_phone_number ?? '';
        toNumber = raw && !raw.startsWith('+') ? `+${raw}` : raw;
        message = msg.text.body.trim();
      } catch {
        return res.json({ status: 'ok' });
      }
    }

    if (!phone || !message) return res.json({ status: 'ok' });

    // Load or create conversation state
    let conv = await this.prisma.conversationState.findUnique({
      where: { phone },
    });
    if (!conv) {
      conv = await this.prisma.conversationState.create({
        data: { phone, state: 'INICIO', context: {} },
      });
    }

    // Process through state machine
    const { reply, nextState, nextContext } = await this.stateMachine.process(
      conv.state,
      conv.context as Record<string, any>,
      message,
      phone,
      toNumber,
    );

    // Persist new state
    await this.prisma.conversationState.update({
      where: { phone },
      data: { state: nextState, context: nextContext },
    });

    if (isTwilio) {
      res.set('Content-Type', 'text/xml');
      return res.send(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${reply}</Message></Response>`,
      );
    }

    // Meta Cloud API — enviar respuesta activamente
    await this.sendMetaMessage(phone, reply);
    return res.json({ status: 'ok' });
  }
}
