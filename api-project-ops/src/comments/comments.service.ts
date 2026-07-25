import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
  constructor(private readonly prisma: PrismaService) {}

  async createForTask(
    workspaceId: string,
    projectId: string,
    taskId: string,
    authorId: string,
    dto: CreateCommentDto,
  ) {
    await this.assertTask(workspaceId, projectId, taskId);
    const mentionIds = await this.resolveMentions(workspaceId, dto.mentions);
    return this.createComment(
      { workspaceId, taskId, authorId },
      dto.body,
      mentionIds,
    );
  }

  async createForIncident(
    workspaceId: string,
    projectId: string,
    incidentId: string,
    authorId: string,
    dto: CreateCommentDto,
  ) {
    await this.assertIncident(workspaceId, projectId, incidentId);
    const mentionIds = await this.resolveMentions(workspaceId, dto.mentions);
    return this.createComment(
      { workspaceId, incidentId, authorId },
      dto.body,
      mentionIds,
    );
  }

  async listForTask(workspaceId: string, projectId: string, taskId: string) {
    await this.assertTask(workspaceId, projectId, taskId);
    return this.listComments({ taskId });
  }

  async listForIncident(
    workspaceId: string,
    projectId: string,
    incidentId: string,
  ) {
    await this.assertIncident(workspaceId, projectId, incidentId);
    return this.listComments({ incidentId });
  }

  // --- internals ---

  private async createComment(
    where: { workspaceId: string; taskId?: string; incidentId?: string; authorId: string },
    body: string,
    mentionIds: string[],
  ) {
    return this.prisma.comment.create({
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
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
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
    });
    if (!incident) throw new NotFoundException('Incident not found');
    return incident;
  }
}
