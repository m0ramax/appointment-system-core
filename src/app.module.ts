import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { WorkScheduleModule } from './work-schedule/work-schedule.module';
import { WebhookModule } from './webhook/webhook.module';
import { BusinessModule } from './business/business.module';
import { ServicesModule } from './services/services.module';
import { InviteModule } from './invite/invite.module';
import { AdminModule } from './admin/admin.module';
import { PlatformSettingsModule } from './platform-settings/platform-settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,  // 1 minuto
        limit: 300,   // 300 req/IP/min — suficiente para uso normal
      },
    ]),
    PrismaModule,
    AuthModule,
    AppointmentsModule,
    WorkScheduleModule,
    WebhookModule,
    BusinessModule,
    ServicesModule,
    InviteModule,
    AdminModule,
    PlatformSettingsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
