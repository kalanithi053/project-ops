import { Injectable, NotFoundException } from '@nestjs/common';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { UPLOAD_DIR, decodeOriginalName } from './upload.config';

const ATTACHMENT_SELECT = {
  id: true,
  taskId: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
  uploader: { select: { id: true, username: true } },
} as const;

/** Documents attached to tasks. Bytes on disk, metadata in Postgres. */
@Injectable()
export class AttachmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForTask(workspaceId: string, projectId: string, taskId: string) {
    await this.assertTask(workspaceId, projectId, taskId);
    return this.prisma.taskAttachment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      select: ATTACHMENT_SELECT,
    });
  }

  /** Every attachment in a project, for the project-level Files view. */
  async listForProject(workspaceId: string, projectId: string) {
    await this.assertProject(workspaceId, projectId);
    return this.prisma.taskAttachment.findMany({
      where: { task: { projectId, deletedAt: null } },
      orderBy: { createdAt: 'desc' },
      select: {
        ...ATTACHMENT_SELECT,
        task: { select: { id: true, name: true, prefix: true } },
      },
    });
  }

  async create(
    workspaceId: string,
    projectId: string,
    taskId: string,
    userId: string,
    file: Express.Multer.File,
  ) {
    await this.assertTask(workspaceId, projectId, taskId);

    return this.prisma.taskAttachment.create({
      data: {
        taskId,
        fileName: decodeOriginalName(file.originalname),
        storedName: file.filename,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedBy: userId,
      },
      select: ATTACHMENT_SELECT,
    });
  }

  /** Resolves an attachment to an absolute path for streaming. */
  async resolveForDownload(
    workspaceId: string,
    projectId: string,
    taskId: string,
    attachmentId: string,
  ) {
    const attachment = await this.getAttachment(
      workspaceId,
      projectId,
      taskId,
      attachmentId,
    );
    return {
      path: join(UPLOAD_DIR, attachment.storedName),
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
    };
  }

  async remove(
    workspaceId: string,
    projectId: string,
    taskId: string,
    attachmentId: string,
  ) {
    const attachment = await this.getAttachment(
      workspaceId,
      projectId,
      taskId,
      attachmentId,
    );

    await this.prisma.taskAttachment.delete({ where: { id: attachmentId } });

    // Best-effort: the row is the source of truth, so a file that's already
    // gone shouldn't fail the request and strand the record.
    await unlink(join(UPLOAD_DIR, attachment.storedName)).catch(() => undefined);

    return { id: attachmentId, deleted: true };
  }

  private async assertProject(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private async assertTask(
    workspaceId: string,
    projectId: string,
    taskId: string,
  ) {
    await this.assertProject(workspaceId, projectId);
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId, deletedAt: null },
      select: { id: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private async getAttachment(
    workspaceId: string,
    projectId: string,
    taskId: string,
    attachmentId: string,
  ) {
    await this.assertTask(workspaceId, projectId, taskId);
    const attachment = await this.prisma.taskAttachment.findFirst({
      where: { id: attachmentId, taskId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    return attachment;
  }
}
