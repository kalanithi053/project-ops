import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { S3Service } from '../aws-s3/s3.service';
import { PrismaService } from '../prisma/prisma.service';

const ATTACHMENT_INCLUDE = {
  uploader: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
} as const;

/** S3 object keys only ever need to be safe path segments — not shown to users. */
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/** Same idea as `sanitizeFileName`, but for a folder segment — hyphenated instead of underscored. */
function sanitizePathSegment(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9._-]+/g, '-');
}

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly activityLog: ActivityLogService,
    private readonly configService: ConfigService,
  ) {}

  async list(workspaceId: string, projectId: string) {
    await this.assertProject(workspaceId, projectId);
    return this.prisma.attachment.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: ATTACHMENT_INCLUDE,
    });
  }

  async create(
    workspaceId: string,
    projectId: string,
    userId: string,
    file: Express.Multer.File | undefined,
  ) {
    const project = await this.assertProject(workspaceId, projectId);
    if (!file) throw new BadRequestException('No file provided');

    // Human-readable prefix (workspace name / project name+id / attachments)
    // so the bucket can be browsed directly in the AWS console — the id
    // suffix on the project folder keeps it unique even if the project is
    // later renamed or shares a name with another.
    const key = [
      this.configService.get('NODE_ENV'),
      `${workspaceId}#(${sanitizePathSegment(project.workspace.name)})`,
      `${projectId}#(${sanitizePathSegment(project.name)})`,
      `${randomUUID()}#(${sanitizeFileName(file.originalname)})`,
    ].join('/');
    await this.s3.upload(key, file.buffer, file.mimetype);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.attachment.create({
        data: {
          workspaceId,
          projectId,
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          s3Key: key,
          uploadedBy: userId,
        },
        include: ATTACHMENT_INCLUDE,
      });

      await this.activityLog.log(
        {
          workspaceId,
          projectId,
          entityType: 'project',
          entityId: projectId,
          action: 'attachment_added',
          userId,
          metadata: { fileName: created.fileName, attachmentId: created.id },
        },
        tx,
      );

      return created;
    });
  }

  async download(workspaceId: string, projectId: string, id: string) {
    const attachment = await this.getOwned(workspaceId, projectId, id);
    const stream = await this.s3.download(attachment.s3Key);
    return { stream, attachment };
  }

  async remove(
    workspaceId: string,
    projectId: string,
    id: string,
    userId: string,
  ) {
    const attachment = await this.getOwned(workspaceId, projectId, id);

    // Best-effort — a dangling S3 object costs pennies and can be cleaned up
    // later; it shouldn't block the user from removing the attachment row.
    await this.s3.delete(attachment.s3Key).catch((error: Error) => {
      this.logger.error(
        `Failed to delete S3 object ${attachment.s3Key}: ${error.message}`,
      );
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.attachment.delete({ where: { id } });
      await this.activityLog.log(
        {
          workspaceId,
          projectId,
          entityType: 'project',
          entityId: projectId,
          action: 'attachment_deleted',
          userId,
          metadata: {
            fileName: attachment.fileName,
            attachmentId: attachment.id,
          },
        },
        tx,
      );
    });

    return { id, deleted: true };
  }

  private async assertProject(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
      include: { workspace: { select: { name: true } } },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private async getOwned(workspaceId: string, projectId: string, id: string) {
    await this.assertProject(workspaceId, projectId);
    const attachment = await this.prisma.attachment.findFirst({
      where: { id, projectId, workspaceId },
      include: ATTACHMENT_INCLUDE,
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    return attachment;
  }
}
