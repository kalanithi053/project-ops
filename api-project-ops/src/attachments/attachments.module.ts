import { Module } from '@nestjs/common';
import {
  ProjectAttachmentsController,
  TaskAttachmentsController,
} from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { ensureUploadDir } from './upload.config';

@Module({
  controllers: [TaskAttachmentsController, ProjectAttachmentsController],
  providers: [AttachmentsService],
})
export class AttachmentsModule {
  constructor() {
    // Create the directory at boot so the first upload isn't the thing that
    // discovers it's missing.
    ensureUploadDir();
  }
}
