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

@ApiTags('webhook')
@Controller('webhook')
export class WebhookController {
  private readonly verifyToken: string;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private stateMachine: StateMachineService,
  ) {
    this.verifyToken = this.config.get<string>('WHATSAPP_VERIFY_TOKEN', 'agendya_verify_token');
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
    let message = '';
    let isTwilio = false;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      // Twilio
      const body = req.body as Record<string, string>;
      phone = (body['From'] ?? '').replace('whatsapp:', '').trim();
      message = (body['Body'] ?? '').trim();
      isTwilio = true;
    } else {
      // Meta
      const body = req.body as any;
      if (body?.object !== 'whatsapp_business_account') {
        return res.json({ status: 'ok' });
      }
      try {
        const msg = body.entry[0].changes[0].value.messages[0];
        if (msg.type !== 'text') return res.json({ status: 'ok' });
        phone = msg.from;
        message = msg.text.body.trim();
      } catch {
        return res.json({ status: 'ok' });
      }
    }

    if (!phone || !message) return res.json({ status: 'ok' });

    // Load or create conversation state
    let conv = await this.prisma.conversationState.findUnique({ where: { phone } });
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
    );

    // Persist new state
    await this.prisma.conversationState.update({
      where: { phone },
      data: { state: nextState, context: nextContext },
    });

    if (isTwilio) {
      res.set('Content-Type', 'application/xml');
      return res.send(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${reply}</Message></Response>`,
      );
    }

    return res.json({ status: 'ok', reply });
  }
}
