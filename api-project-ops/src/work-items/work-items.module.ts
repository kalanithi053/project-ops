import { Module } from '@nestjs/common';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { AttachmentsModule } from '../attachments/attachments.module';
import { MailModule } from '../mail/mail.module';
import {
  WorkItemsController,
  WorkspaceWorkItemsController,
} from './work-items.controller';
import { WorkItemsService } from './work-items.service';

@Module({
  imports: [ActivityLogModule, MailModule, AttachmentsModule],
  controllers: [WorkItemsController, WorkspaceWorkItemsController],
  providers: [WorkItemsService],
  exports: [WorkItemsService],
})
export class WorkItemsModule {}
