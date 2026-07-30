import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

const AUTHOR_SELECT = {
  select: { id: true, email: true, firstName: true, lastName: true },
} as const;

const COMMENT_INCLUDE = {
  author: AUTHOR_SELECT,
  mentions: { include: { user: AUTHOR_SELECT } },
} as const;

/** Fallback activity log entityType when the work item has no WorkType set. */
const DEFAULT_ENTITY_TYPE = 'task';

/**
 * Strips markup (including mention spans and their data-mention-email
 * attribute) down to visible text, so the activity log never surfaces raw
 * HTML or a tagged user's email address.
 */
function plainTextPreview(body: string, maxLength = 200): string {
  const text = body
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, maxLength);
}

/**
 * Comments — either standalone workspace comments, or comments on a specific
 * work item. Other users can be tagged by email (`mentions`); each tagged
 * email must belong to a member of the workspace and is stored as a
 * CommentMention row.
 */
@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly mail: MailService,
  ) {}

  list(workspaceId: string) {
    return this.prisma.comment.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
      include: COMMENT_INCLUDE,
    });
  }

  async create(workspaceId: string, authorId: string, dto: CreateCommentDto) {
    const mentionIds = await this.resolveMentions(workspaceId, dto.mentions);

    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: {
          workspaceId,
          authorId,
          body: dto.body,
          mentions: {
            createMany: {
              data: mentionIds.map((userId) => ({ userId })),
              skipDuplicates: true,
            },
          },
        },
        include: COMMENT_INCLUDE,
      });

      await this.activityLog.log(
        {
          workspaceId,
          entityType: 'comment',
          entityId: created.id,
          action: 'comment_added',
          userId: authorId,
          metadata: { preview: plainTextPreview(dto.body) },
        },
        tx,
      );

      return created;
    });

    await this.notifyMentions(workspaceId, comment, '/comments');
    return comment;
  }

  async update(
    workspaceId: string,
    commentId: string,
    userId: string,
    dto: CreateCommentDto,
  ) {
    const comment = await this.getOwned(workspaceId, commentId);
    this.assertAuthor(comment.authorId, userId);
    const existingMentionIds = new Set(
      comment.mentions.map((mention) => mention.userId),
    );
    const mentionIds = dto.mentions
      ? await this.resolveMentions(workspaceId, dto.mentions)
      : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.comment.update({
        where: { id: commentId },
        data: {
          body: dto.body,
          mentions:
            mentionIds === undefined
              ? undefined
              : {
                  deleteMany: {},
                  createMany: {
                    data: mentionIds.map((mentionedUserId) => ({
                      userId: mentionedUserId,
                    })),
                    skipDuplicates: true,
                  },
                },
        },
        include: COMMENT_INCLUDE,
      });

      await this.activityLog.log(
        {
          workspaceId,
          entityType: 'comment',
          entityId: commentId,
          action: 'comment_updated',
          userId,
          metadata: { preview: plainTextPreview(dto.body) },
        },
        tx,
      );

      return saved;
    });

    await this.notifyMentions(
      workspaceId,
      {
        ...updated,
        mentions: updated.mentions.filter(
          (mention) => !existingMentionIds.has(mention.user.id),
        ),
      },
      '/comments',
    );
    return updated;
  }

  async remove(workspaceId: string, commentId: string, userId: string) {
    const comment = await this.getOwned(workspaceId, commentId);
    this.assertAuthor(comment.authorId, userId);

    await this.prisma.$transaction(async (tx) => {
      await tx.comment.delete({ where: { id: commentId } });
      await this.activityLog.log(
        {
          workspaceId,
          entityType: 'comment',
          entityId: commentId,
          action: 'comment_deleted',
          userId,
        },
        tx,
      );
    });

    return { id: commentId, deleted: true };
  }

  // --- work item comments ---

  async listForWorkItem(
    workspaceId: string,
    projectId: string,
    workItemId: string,
  ) {
    await this.assertWorkItem(workspaceId, projectId, workItemId);
    return this.prisma.comment.findMany({
      where: { workItemId },
      orderBy: { createdAt: 'asc' },
      include: COMMENT_INCLUDE,
    });
  }

  async createForWorkItem(
    workspaceId: string,
    projectId: string,
    workItemId: string,
    authorId: string,
    dto: CreateCommentDto,
  ) {
    const workItem = await this.assertWorkItem(
      workspaceId,
      projectId,
      workItemId,
    );
    const mentionIds = await this.resolveMentions(workspaceId, dto.mentions);
    const entityType = workItem.workItemType?.category ?? DEFAULT_ENTITY_TYPE;

    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: {
          workspaceId,
          workItemId,
          authorId,
          body: dto.body,
          mentions: {
            createMany: {
              data: mentionIds.map((userId) => ({ userId })),
              skipDuplicates: true,
            },
          },
        },
        include: COMMENT_INCLUDE,
      });

      await this.activityLog.log(
        {
          workspaceId,
          projectId,
          entityType,
          entityId: workItemId,
          action: 'comment_added',
          userId: authorId,
          metadata: { commentId: created.id, preview: plainTextPreview(dto.body) },
        },
        tx,
      );

      return created;
    });

    await this.notifyMentions(
      workspaceId,
      comment,
      `/projects/${projectId}/work-items/${workItemId}`,
    );
    return comment;
  }

  async updateForWorkItem(
    workspaceId: string,
    projectId: string,
    workItemId: string,
    commentId: string,
    userId: string,
    dto: CreateCommentDto,
  ) {
    const workItem = await this.assertWorkItem(
      workspaceId,
      projectId,
      workItemId,
    );
    const comment = await this.getWorkItemComment(
      workspaceId,
      projectId,
      workItemId,
      commentId,
    );
    this.assertAuthor(comment.authorId, userId);
    const existingMentionIds = new Set(
      comment.mentions.map((mention) => mention.userId),
    );
    const mentionIds = dto.mentions
      ? await this.resolveMentions(workspaceId, dto.mentions)
      : undefined;
    const entityType = workItem.workItemType?.category ?? DEFAULT_ENTITY_TYPE;

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.comment.update({
        where: { id: commentId },
        data: {
          body: dto.body,
          mentions:
            mentionIds === undefined
              ? undefined
              : {
                  deleteMany: {},
                  createMany: {
                    data: mentionIds.map((mentionedUserId) => ({
                      userId: mentionedUserId,
                    })),
                    skipDuplicates: true,
                  },
                },
        },
        include: COMMENT_INCLUDE,
      });

      await this.activityLog.log(
        {
          workspaceId,
          projectId,
          entityType,
          entityId: workItemId,
          action: 'comment_updated',
          userId,
          metadata: { commentId, preview: plainTextPreview(dto.body) },
        },
        tx,
      );

      return saved;
    });

    await this.notifyMentions(
      workspaceId,
      {
        ...updated,
        mentions: updated.mentions.filter(
          (mention) => !existingMentionIds.has(mention.user.id),
        ),
      },
      `/projects/${projectId}/work-items/${workItemId}`,
    );
    return updated;
  }

  async removeForWorkItem(
    workspaceId: string,
    projectId: string,
    workItemId: string,
    commentId: string,
    userId: string,
  ) {
    const workItem = await this.assertWorkItem(
      workspaceId,
      projectId,
      workItemId,
    );
    const comment = await this.getWorkItemComment(
      workspaceId,
      projectId,
      workItemId,
      commentId,
    );
    this.assertAuthor(comment.authorId, userId);
    const entityType = workItem.workItemType?.category ?? DEFAULT_ENTITY_TYPE;

    await this.prisma.$transaction(async (tx) => {
      await tx.comment.delete({ where: { id: commentId } });
      await this.activityLog.log(
        {
          workspaceId,
          projectId,
          entityType,
          entityId: workItemId,
          action: 'comment_deleted',
          userId,
          metadata: { commentId },
        },
        tx,
      );
    });

    return { id: commentId, deleted: true };
  }

  // --- internals ---

  private async getOwned(workspaceId: string, commentId: string) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, workspaceId },
      select: {
        id: true,
        authorId: true,
        mentions: { select: { userId: true } },
      },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    return comment;
  }

  private async assertWorkItem(
    workspaceId: string,
    projectId: string,
    workItemId: string,
  ) {
    const workItem = await this.prisma.workItem.findFirst({
      where: { id: workItemId, projectId, project: { workspaceId } },
      include: { workItemType: { select: { category: true } } },
    });
    if (!workItem) throw new NotFoundException('Work item not found');
    return workItem;
  }

  private async getWorkItemComment(
    workspaceId: string,
    projectId: string,
    workItemId: string,
    commentId: string,
  ) {
    const comment = await this.prisma.comment.findFirst({
      where: {
        id: commentId,
        workItemId,
        workspaceId,
        workItem: { projectId },
      },
      select: {
        id: true,
        authorId: true,
        mentions: { select: { userId: true } },
      },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    return comment;
  }

  private assertAuthor(authorId: string, userId: string) {
    if (authorId !== userId) {
      throw new ForbiddenException('Only the comment author can change it');
    }
  }

  /**
   * Resolves tagged emails to user ids. Every email must belong to an existing
   * user who is a (non-removed) member of the workspace; otherwise 400 listing
   * the offending emails.
   */
  private async resolveMentions(
    workspaceId: string,
    emails?: string[],
  ): Promise<string[]> {
    if (!emails?.length) return [];

    const members = await this.prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        status: { not: 'removed' },
        user: { email: { in: emails } },
      },
      select: { userId: true, user: { select: { email: true } } },
    });

    const foundEmails = new Set(members.map((m) => m.user.email));
    const unknown = emails.filter((e) => !foundEmails.has(e));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Not workspace members: ${unknown.join(', ')}`,
      );
    }

    return members.map((m) => m.userId);
  }

  private async notifyMentions(
    workspaceId: string,
    comment: {
      id: string;
      body: string;
      author: {
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
      };
      mentions: Array<{
        user: {
          id: string;
          email: string;
          firstName: string | null;
          lastName: string | null;
        };
      }>;
    },
    actionPath: string,
  ) {
    const recipients = comment.mentions
      .map((mention) => mention.user)
      .filter((user) => user.id !== comment.author.id);
    if (recipients.length === 0) return;

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, slug: true },
    });
    const authorName =
      [comment.author.firstName, comment.author.lastName]
        .filter(Boolean)
        .join(' ') || comment.author.email.split('@')[0];

    await Promise.all(
      recipients.map((user) =>
        this.mail
          .sendCommentMentionEmail(user.email, {
            authorName,
            workspaceName: workspace?.name ?? '',
            body: comment.body,
            actionUrl: this.mail.appUrl(`/${workspace?.slug}${actionPath}`),
          })
          .catch((error) =>
            this.logger.error(
              `Could not notify mentioned user ${user.id}: ${(error as Error).message}`,
            ),
          ),
      ),
    );
  }
}
