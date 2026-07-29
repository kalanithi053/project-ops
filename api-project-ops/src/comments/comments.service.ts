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

/**
 * Comments on tasks and incident tickets. Other users can be tagged by email
 * (`mentions`); each tagged email must belong to a member of the workspace and
 * is stored as a CommentMention row.
 */
@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly mail: MailService,
  ) {}

  async createForTask(
    workspaceId: string,
    projectId: string,
    taskId: string,
    authorId: string,
    dto: CreateCommentDto,
  ) {
    const task = await this.assertTask(workspaceId, projectId, taskId);
    const mentionIds = await this.resolveMentions(workspaceId, dto.mentions);
    const comment = await this.createComment(
      { workspaceId, projectId, taskId, authorId },
      dto.body,
      mentionIds,
    );
    await this.notifyMentions(comment, {
      projectName: task.project.name,
      entityLabel: 'task',
      entityName: task.prefix ? `${task.prefix} · ${task.name}` : task.name,
      actionUrl: this.mail.appUrl(
        `/${task.project.workspace.slug}/projects/${projectId}/tasks/${taskId}`,
      ),
    });
    return comment;
  }

  async createForIncident(
    workspaceId: string,
    projectId: string,
    incidentId: string,
    authorId: string,
    dto: CreateCommentDto,
  ) {
    const incident = await this.assertIncident(
      workspaceId,
      projectId,
      incidentId,
    );
    const mentionIds = await this.resolveMentions(workspaceId, dto.mentions);
    const comment = await this.createComment(
      { workspaceId, projectId, incidentId, authorId },
      dto.body,
      mentionIds,
    );
    await this.notifyMentions(comment, {
      projectName: incident.project.name,
      entityLabel: 'incident',
      entityName: incident.title,
      actionUrl: this.mail.appUrl(
        `/${incident.project.workspace.slug}/projects/${projectId}/incidents/${incidentId}`,
      ),
    });
    return comment;
  }

  async listForTask(workspaceId: string, projectId: string, taskId: string) {
    await this.assertTask(workspaceId, projectId, taskId);
    return this.listComments({ taskId });
  }

  async updateForTask(
    workspaceId: string,
    projectId: string,
    taskId: string,
    commentId: string,
    userId: string,
    dto: CreateCommentDto,
  ) {
    await this.assertTask(workspaceId, projectId, taskId);
    const comment = await this.getTaskComment(
      workspaceId,
      projectId,
      taskId,
      commentId,
    );
    this.assertAuthor(comment.authorId, userId);
    const existingMentionIds = new Set(
      comment.mentions.map((mention) => mention.userId),
    );
    const mentionIds = dto.mentions
      ? await this.resolveMentions(workspaceId, dto.mentions)
      : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.comment.update({
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
        include: {
          author: AUTHOR_SELECT,
          mentions: { include: { user: AUTHOR_SELECT } },
        },
      });

      await this.activityLog.log(
        {
          workspaceId,
          projectId,
          entityType: 'task',
          entityId: taskId,
          action: 'comment_updated',
          userId,
          metadata: { commentId, preview: dto.body.slice(0, 200) },
        },
        tx,
      );

      return updated;
    });

    const task = await this.assertTask(workspaceId, projectId, taskId);
    await this.notifyMentions(
      {
        ...updated,
        mentions: updated.mentions.filter(
          (mention) => !existingMentionIds.has(mention.user.id),
        ),
      },
      {
        projectName: task.project.name,
        entityLabel: 'task',
        entityName: task.prefix ? `${task.prefix} · ${task.name}` : task.name,
        actionUrl: this.mail.appUrl(
          `/${task.project.workspace.slug}/projects/${projectId}/tasks/${taskId}`,
        ),
      },
    );
    return updated;
  }

  async removeForTask(
    workspaceId: string,
    projectId: string,
    taskId: string,
    commentId: string,
    userId: string,
  ) {
    await this.assertTask(workspaceId, projectId, taskId);
    const comment = await this.getTaskComment(
      workspaceId,
      projectId,
      taskId,
      commentId,
    );
    this.assertAuthor(comment.authorId, userId);

    await this.prisma.$transaction(async (tx) => {
      await tx.comment.delete({ where: { id: commentId } });
      await this.activityLog.log(
        {
          workspaceId,
          projectId,
          entityType: 'task',
          entityId: taskId,
          action: 'comment_deleted',
          userId,
          metadata: { commentId },
        },
        tx,
      );
    });

    return { id: commentId, deleted: true };
  }

  async listForIncident(
    workspaceId: string,
    projectId: string,
    incidentId: string,
  ) {
    await this.assertIncident(workspaceId, projectId, incidentId);
    return this.listComments({ incidentId });
  }

  async updateForIncident(
    workspaceId: string,
    projectId: string,
    incidentId: string,
    commentId: string,
    userId: string,
    dto: CreateCommentDto,
  ) {
    const incident = await this.assertIncident(workspaceId, projectId, incidentId);
    const comment = await this.getIncidentComment(
      workspaceId,
      projectId,
      incidentId,
      commentId,
    );
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
        include: {
          author: AUTHOR_SELECT,
          mentions: { include: { user: AUTHOR_SELECT } },
        },
      });

      await this.activityLog.log(
        {
          workspaceId,
          projectId,
          entityType: 'incident',
          entityId: incidentId,
          action: 'comment_updated',
          userId,
          metadata: { commentId, preview: dto.body.slice(0, 200) },
        },
        tx,
      );
      return saved;
    });

    await this.notifyMentions(
      {
        ...updated,
        mentions: updated.mentions.filter(
          (mention) => !existingMentionIds.has(mention.user.id),
        ),
      },
      {
        projectName: incident.project.name,
        entityLabel: 'incident',
        entityName: incident.title,
        actionUrl: this.mail.appUrl(
          `/${incident.project.workspace.slug}/projects/${projectId}/incidents/${incidentId}`,
        ),
      },
    );
    return updated;
  }

  async removeForIncident(
    workspaceId: string,
    projectId: string,
    incidentId: string,
    commentId: string,
    userId: string,
  ) {
    await this.assertIncident(workspaceId, projectId, incidentId);
    const comment = await this.getIncidentComment(
      workspaceId,
      projectId,
      incidentId,
      commentId,
    );
    this.assertAuthor(comment.authorId, userId);

    await this.prisma.$transaction(async (tx) => {
      await tx.comment.delete({ where: { id: commentId } });
      await this.activityLog.log(
        {
          workspaceId,
          projectId,
          entityType: 'incident',
          entityId: incidentId,
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

  private async createComment(
    where: {
      workspaceId: string;
      projectId: string;
      taskId?: string;
      incidentId?: string;
      authorId: string;
    },
    body: string,
    mentionIds: string[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          workspaceId: where.workspaceId,
          taskId: where.taskId ?? null,
          incidentId: where.incidentId ?? null,
          authorId: where.authorId,
          body,
          mentions: {
            createMany: {
              data: mentionIds.map((userId) => ({ userId })),
              skipDuplicates: true,
            },
          },
        },
        include: {
          author: AUTHOR_SELECT,
          mentions: { include: { user: AUTHOR_SELECT } },
        },
      });

      await this.activityLog.log(
        {
          workspaceId: where.workspaceId,
          projectId: where.projectId,
          entityType: where.taskId ? 'task' : 'incident',
          entityId: where.taskId ?? where.incidentId,
          action: 'comment_added',
          userId: where.authorId,
          metadata: { commentId: comment.id, preview: body.slice(0, 200) },
        },
        tx,
      );

      return comment;
    });
  }

  private listComments(where: { taskId?: string; incidentId?: string }) {
    return this.prisma.comment.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        author: AUTHOR_SELECT,
        mentions: { include: { user: AUTHOR_SELECT } },
      },
    });
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

  private async assertTask(
    workspaceId: string,
    projectId: string,
    taskId: string,
  ) {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        projectId,
        deletedAt: null,
        project: { workspaceId, deletedAt: null },
      },
      include: {
        project: {
          select: { name: true, workspace: { select: { slug: true } } },
        },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private async getTaskComment(
    workspaceId: string,
    projectId: string,
    taskId: string,
    commentId: string,
  ) {
    const comment = await this.prisma.comment.findFirst({
      where: {
        id: commentId,
        taskId,
        workspaceId,
        task: { projectId, deletedAt: null },
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

  private async getIncidentComment(
    workspaceId: string,
    projectId: string,
    incidentId: string,
    commentId: string,
  ) {
    const comment = await this.prisma.comment.findFirst({
      where: {
        id: commentId,
        incidentId,
        workspaceId,
        incident: { projectId },
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

  private async notifyMentions(
    comment: {
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
    entity: {
      projectName: string;
      entityLabel: 'task' | 'incident';
      entityName: string;
      actionUrl: string;
    },
  ) {
    const authorName =
      [comment.author.firstName, comment.author.lastName]
        .filter(Boolean)
        .join(' ') || comment.author.email;
    const recipients = comment.mentions
      .map((mention) => mention.user)
      .filter((user) => user.id !== comment.author.id);

    await Promise.all(
      recipients.map((user) =>
        this.mail
          .sendCommentMentionEmail(user.email, {
            authorName,
            ...entity,
            body: comment.body,
          })
          .catch((error) =>
            this.logger.error(
              `Could not notify mentioned user ${user.id}: ${(error as Error).message}`,
            ),
          ),
      ),
    );
  }

  private async assertIncident(
    workspaceId: string,
    projectId: string,
    incidentId: string,
  ) {
    const incident = await this.prisma.incident.findFirst({
      where: {
        id: incidentId,
        projectId,
        project: { workspaceId, deletedAt: null },
      },
      include: {
        project: {
          select: { name: true, workspace: { select: { slug: true } } },
        },
      },
    });
    if (!incident) throw new NotFoundException('Incident not found');
    return incident;
  }
}
