import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { StateMachineService } from './state-machine.service';
import { AppointmentsModule } from '../appointments/appointments.module';
import { WorkScheduleModule } from '../work-schedule/work-schedule.module';

@Module({
  imports: [AppointmentsModule, WorkScheduleModule],
  controllers: [WebhookController],
  providers: [StateMachineService],
})
export class WebhookModule {}
