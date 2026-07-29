import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { ListIncidentsQueryDto } from './dto/list-incidents-query.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';

const PERSON_SELECT = {
  select: { id: true, email: true, firstName: true, lastName: true },
} as const;

function displayName(user: {
  email: string;
  firstName: string | null;
  lastName: string | null;
}): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return name || user.email;
}

/**
 * Standalone incident tickets, scoped to a project (not bound to any task).
 */
@Injectable()
export class IncidentsService {
  private readonly logger = new Logger(IncidentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly activityLog: ActivityLogService,
  ) {}

  /** Raise an incident ticket for an implementation flaw in the project. */
  async create(
    workspaceId: string,
    projectId: string,
    userId: string,
    dto: CreateIncidentDto,
  ) {
    const project = await this.assertProject(workspaceId, projectId);
    if (dto.assigneeId) await this.assertAssignee(workspaceId, dto.assigneeId);
    if (dto.qaAssigneeId) await this.assertAssignee(workspaceId, dto.qaAssigneeId);
    const statusId = dto.statusId ?? (await this.getDefaultStatusId(workspaceId));
    await this.assertStatus(workspaceId, statusId);

    const incident = await this.prisma.$transaction(async (tx) => {
      const created = await tx.incident.create({
        data: {
          workspaceId,
          projectId,
          title: dto.title,
          description: dto.description,
          statusId,
          reportedBy: userId,
          assigneeId: dto.assigneeId ?? userId,
          qaAssigneeId: dto.qaAssigneeId ?? null,
          estimateHours: dto.estimateHours ?? null,
          completedHours: dto.completedHours ?? null,
        },
        include: {
          reporter: PERSON_SELECT,
          assignee: PERSON_SELECT,
          qaAssignee: PERSON_SELECT,
          status: { select: { id: true, name: true, category: true, color: true } },
        },
      });

      await this.activityLog.log(
        {
          workspaceId,
          projectId,
          entityType: 'incident',
          entityId: created.id,
          action: 'created',
          userId,
          metadata: { title: created.title, assigneeId: created.assigneeId },
        },
        tx,
      );

      return created;
    });

    await this.notifyIncidentCreated(project, incident);
    if (incident.qaAssignee) {
      await this.notifyQaAssignment(incident.qaAssignee.email, incident, project);
    }
    return incident;
  }

  /** Activity log entries for one incident, newest first. */
  async getActivity(
    workspaceId: string,
    projectId: string,
    incidentId: string,
  ) {
    await this.assertProject(workspaceId, projectId);
    return this.activityLog.getTimeline(workspaceId, incidentId, 'incident');
  }

  /** List the project's incident tickets. */
  async list(
    workspaceId: string,
    projectId: string,
    filters: ListIncidentsQueryDto,
  ) {
    await this.assertProject(workspaceId, projectId);
    return this.prisma.incident.findMany({
      where: {
        projectId,
        ...(filters.assigneeIds?.length
          ? {
              OR: [
                { assigneeId: { in: filters.assigneeIds } },
                {
                  assigneeId: null,
                  reportedBy: { in: filters.assigneeIds },
                },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: PERSON_SELECT,
        assignee: PERSON_SELECT,
        qaAssignee: PERSON_SELECT,
        status: { select: { id: true, name: true, category: true, color: true } },
        _count: { select: { comments: true } },
      },
    });
  }

  /** Fetch one incident (with its comment count). */
  async findOne(workspaceId: string, projectId: string, incidentId: string) {
    await this.assertProject(workspaceId, projectId);
    const incident = await this.prisma.incident.findFirst({
      where: { id: incidentId, projectId },
      include: {
        reporter: PERSON_SELECT,
        assignee: PERSON_SELECT,
        qaAssignee: PERSON_SELECT,
        status: { select: { id: true, name: true, category: true, color: true } },
        _count: { select: { comments: true } },
      },
    });
    if (!incident) throw new NotFoundException('Incident not found');
    return incident;
  }

  async update(
    workspaceId: string,
    projectId: string,
    incidentId: string,
    userId: string,
    dto: UpdateIncidentDto,
  ) {
    const project = await this.assertProject(workspaceId, projectId);
    const incident = await this.prisma.incident.findFirst({
      where: { id: incidentId, projectId },
    });
    if (!incident) throw new NotFoundException('Incident not found');
    if (dto.assigneeId) await this.assertAssignee(workspaceId, dto.assigneeId);
    if (dto.qaAssigneeId) await this.assertAssignee(workspaceId, dto.qaAssigneeId);
    if (dto.statusId) await this.assertStatus(workspaceId, dto.statusId);
    const assigneeChanged =
      !!dto.assigneeId && dto.assigneeId !== incident.assigneeId;
    const qaAssigneeChanged =
      !!dto.qaAssigneeId && dto.qaAssigneeId !== incident.qaAssigneeId;

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const updateFields = [
      'title',
      'description',
      'assigneeId',
      'qaAssigneeId',
      'estimateHours',
      'completedHours',
      'statusId',
    ] as const;
    for (const field of updateFields) {
      const value = dto[field];
      if (value !== undefined && incident[field] !== value) {
        changes[field] = { from: incident[field], to: value };
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.incident.update({
        where: { id: incidentId },
        data: dto,
        include: {
          reporter: PERSON_SELECT,
          assignee: PERSON_SELECT,
          qaAssignee: PERSON_SELECT,
          status: { select: { id: true, name: true, category: true, color: true } },
          _count: { select: { comments: true } },
        },
      });

      if (Object.keys(changes).length > 0) {
        await this.activityLog.log(
          {
            workspaceId,
            projectId,
            entityType: 'incident',
            entityId: incidentId,
            action: 'updated',
            userId,
            metadata: { changes },
          },
          tx,
        );
      }
      return saved;
    });

    if (assigneeChanged && updated.assignee) {
      await this.mail
        .sendAssignmentNotificationEmail(updated.assignee.email, {
          entityLabel: 'incident',
          entityName: updated.title,
          projectName: project.name,
          actionUrl: this.mail.appUrl(
            `/${project.workspace.slug}/projects/${projectId}/incidents/${updated.id}`,
          ),
        })
        .catch((err) =>
          this.logger.error(
            `Failed to send assignment email to=${updated.assignee?.email}: ${(err as Error).message}`,
          ),
        );
    }
    if (qaAssigneeChanged && updated.qaAssignee) {
      await this.notifyQaAssignment(updated.qaAssignee.email, updated, project);
    }

    return updated;
  }

  /** On-demand nudge — emails the assignee with the incident's current status. */
  async notifyAssignee(
    workspaceId: string,
    projectId: string,
    incidentId: string,
  ) {
    const project = await this.assertProject(workspaceId, projectId);
    const incident = await this.prisma.incident.findFirst({
      where: { id: incidentId, projectId },
      include: {
        assignee: PERSON_SELECT,
        status: { select: { name: true } },
      },
    });
    if (!incident) throw new NotFoundException('Incident not found');
    if (!incident.assignee) {
      throw new BadRequestException('Incident has no assignee to notify');
    }

    await this.mail.sendStatusNotificationEmail(incident.assignee.email, {
      entityLabel: 'incident',
      entityName: incident.title,
      projectName: project.name,
      statusName: incident.status.name,
      actionUrl: this.mail.appUrl(
        `/${project.workspace.slug}/projects/${projectId}/incidents/${incidentId}`,
      ),
    });

    return { notified: true, assignee: incident.assignee.email };
  }

  /** Notifies the project owner that a new incident was raised. Best-effort. */
  private async notifyIncidentCreated(
    project: {
      id: string;
      name: string;
      ownerId: string;
      workspace: { slug: string };
    },
    incident: {
      id: string;
      title: string;
      reporter: {
        email: string;
        firstName: string | null;
        lastName: string | null;
      };
      assignee: {
        email: string;
        firstName: string | null;
        lastName: string | null;
      } | null;
    },
  ): Promise<void> {
    const owner = await this.prisma.user.findUnique({
      where: { id: project.ownerId },
      select: { email: true },
    });
    if (!owner) return;

    await this.mail
      .sendIncidentCreatedEmail(owner.email, {
        reporterName: displayName(incident.reporter),
        assigneeName: incident.assignee ? displayName(incident.assignee) : null,
        incidentTitle: incident.title,
        projectName: project.name,
        incidentId: incident.id,
        actionUrl: this.mail.appUrl(
          `/${project.workspace.slug}/projects/${project.id}/incidents/${incident.id}`,
        ),
      })
      .catch((err) =>
        this.logger.error(
          `Failed to send incident created email to=${owner.email}: ${(err as Error).message}`,
        ),
      );
  }

  private async notifyQaAssignment(
    email: string,
    incident: { id: string; title: string },
    project: { id: string; name: string; workspace: { slug: string } },
  ): Promise<void> {
    await this.mail
      .sendAssignmentNotificationEmail(email, {
        entityLabel: 'incident',
        entityName: incident.title,
        projectName: project.name,
        assignmentRole: 'QA',
        actionUrl: this.mail.appUrl(
          `/${project.workspace.slug}/projects/${project.id}/incidents/${incident.id}`,
        ),
      })
      .catch((err) =>
        this.logger.error(
          `Failed to send QA assignment email to=${email}: ${(err as Error).message}`,
        ),
      );
  }

  private async assertProject(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
      include: { workspace: { select: { slug: true } } },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private async assertAssignee(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId, status: { not: 'removed' } },
    });
    if (!member) {
      throw new BadRequestException('Assignee is not a workspace member');
    }
  }

  private async assertStatus(workspaceId: string, statusId: string) {
    const status = await this.prisma.ticketStatus.findFirst({
      where: { id: statusId, workspaceId },
    });
    if (!status) {
      throw new BadRequestException('Status not found in workspace');
    }
  }

  private async getDefaultStatusId(workspaceId: string): Promise<string> {
    const status =
      (await this.prisma.ticketStatus.findFirst({
        where: { workspaceId, isDefault: true },
        select: { id: true },
      })) ??
      (await this.prisma.ticketStatus.findFirst({
        where: { workspaceId },
        orderBy: { order: 'asc' },
        select: { id: true },
      }));
    if (!status) {
      throw new BadRequestException('No ticket statuses are configured');
    }
    return status.id;
  }
}
