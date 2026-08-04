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

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/** Mirrored on the frontend (use-attachments.ts) for the file picker's `accept` + client-side check. */
export const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
]);

export const sanitizePathSegment = (value: string): string => {
  return value
    .replace(/\s*-\s*/g, ' ')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/ /g, '_')
    .trim()
    .toUpperCase();
};

/**
 * Attachment ids referenced by `<img data-attachment-id="...">` tags in a
 * rich-text HTML string (a project/work item description or a comment body).
 * Used to diff old vs new content on edit so an image dropped from the text
 * gets its attachment cleaned up too, instead of being silently orphaned.
 */
export function extractAttachmentIds(
  html: string | null | undefined,
): Set<string> {
  const ids = new Set<string>();
  if (!html) return ids;
  const pattern = /data-attachment-id="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    ids.add(match[1]);
  }
  return ids;
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

  /**
   * Project-level attachments only — pass `workItemId` to scope to one work
   * item's own list. Never includes inline images embedded via a rich text
   * editor (see `isInline`) — those aren't "a document" the user manages
   * here, they're part of the description/comment text itself.
   */
  async list(workspaceId: string, projectId: string, workItemId?: string) {
    if (workItemId) {
      await this.assertWorkItem(workspaceId, projectId, workItemId);
    } else {
      await this.assertProject(workspaceId, projectId);
    }
    return this.prisma.attachment.findMany({
      where: { projectId, workItemId: workItemId ?? null, isInline: false },
      orderBy: { createdAt: 'desc' },
      include: ATTACHMENT_INCLUDE,
    });
  }

  /**
   * Pass `workItemId` to attach the file to that work item instead of the
   * project generally. Pass `isInline` for an image embedded via a rich
   * text editor's image button (a description/comment) rather than a
   * deliberate upload through an Attachments list — it's excluded from
   * every Attachments listing and isn't logged to the activity feed.
   */
  async create(
    workspaceId: string,
    projectId: string,
    userId: string,
    file: Express.Multer.File | undefined,
    workItemId?: string,
    isInline = false,
  ) {
    const project = await this.assertProject(workspaceId, projectId);
    const workItem = workItemId
      ? await this.assertWorkItem(workspaceId, projectId, workItemId)
      : null;
    if (!file) throw new BadRequestException('No file provided');
    if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Allowed: images, PDF, Word, Excel, CSV.`,
      );
    }

    // Human-readable prefix (workspace name / project name+id / [work item
    // id+prefix /] attachments) so the bucket can be browsed directly in the
    // AWS console — the id suffix on each folder keeps it unique even if the
    // name is later changed or shared with another project/work item.
    const key = [
      this.configService.get('NODE_ENV'),
      `${workspaceId}#${sanitizePathSegment(project.workspace.name)}`,
      `${projectId}#${sanitizePathSegment(project.name)}`,
      ...(workItem
        ? [
            `${workItem.id}#${sanitizePathSegment(workItem.prefix ?? workItem.id)}`,
          ]
        : []),
      `${randomUUID()}#${sanitizeFileName(file.originalname)}`,
    ].join('/');
    await this.s3.upload(key, file.buffer, file.mimetype);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.attachment.create({
        data: {
          workspaceId,
          projectId,
          workItemId,
          isInline,
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          s3Key: key,
          uploadedBy: userId,
        },
        include: ATTACHMENT_INCLUDE,
      });

      // An inline embed is logged as part of the description/comment update
      // that references it, not as its own "attached a file" activity entry.
      if (!isInline) {
        await this.activityLog.log(
          {
            workspaceId,
            projectId,
            entityType: workItemId ? 'attachment' : 'project',
            entityId: workItemId ?? projectId,
            action: 'attachment_added',
            userId,
            metadata: { fileName: created.fileName, attachmentId: created.id },
          },
          tx,
        );
      }

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
          entityType: attachment.workItemId ? 'attachment' : 'project',
          entityId: attachment.workItemId ?? projectId,
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

  /**
   * Cleans up inline images (S3 object + row) that a description/comment
   * edit or delete dropped — called by ProjectsService/CommentsService after
   * diffing old vs new content with `extractAttachmentIds`. No activity log
   * entry: this is an implicit side effect of the edit, not its own action,
   * mirroring `create()`'s inline uploads not getting one either.
   */
  async deleteByIds(workspaceId: string, ids: Iterable<string>): Promise<void> {
    const idList = Array.from(ids);
    if (idList.length === 0) return;

    const attachments = await this.prisma.attachment.findMany({
      where: { id: { in: idList }, workspaceId },
    });
    if (attachments.length === 0) return;

    await Promise.all(
      attachments.map((attachment) =>
        this.s3.delete(attachment.s3Key).catch((error: Error) => {
          this.logger.error(
            `Failed to delete S3 object ${attachment.s3Key}: ${error.message}`,
          );
        }),
      ),
    );

    await this.prisma.attachment.deleteMany({
      where: { id: { in: attachments.map((attachment) => attachment.id) } },
    });
  }

  private async assertProject(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
      include: { workspace: { select: { name: true } } },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private async assertWorkItem(
    workspaceId: string,
    projectId: string,
    workItemId: string,
  ) {
    const workItem = await this.prisma.workItem.findFirst({
      where: { id: workItemId, projectId, project: { workspaceId } },
    });
    if (!workItem) throw new NotFoundException('Work item not found');
    return workItem;
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
