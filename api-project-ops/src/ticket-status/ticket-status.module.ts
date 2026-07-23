import { Module } from '@nestjs/common';
import { TicketStatusController } from './ticket-status.controller';
import { TicketStatusService } from './ticket-status.service';

@Module({
  controllers: [TicketStatusController],
  providers: [TicketStatusService],
  exports: [TicketStatusService],
})
export class TicketStatusModule {}
