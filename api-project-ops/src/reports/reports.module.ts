import { Module } from '@nestjs/common';
import {
  ReportsController,
  WorkspaceReportsController,
} from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  controllers: [ReportsController, WorkspaceReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
