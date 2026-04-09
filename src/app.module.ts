import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { WorkScheduleModule } from './work-schedule/work-schedule.module';
import { WebhookModule } from './webhook/webhook.module';
import { BusinessModule } from './business/business.module';
import { ServicesModule } from './services/services.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    AppointmentsModule,
    WorkScheduleModule,
    WebhookModule,
    BusinessModule,
    ServicesModule,
  ],
})
export class AppModule {}
