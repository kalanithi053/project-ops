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

    const incident = await this.prisma.$transaction(async (tx) => {
      const created = await tx.incident.create({
        data: {
          workspaceId,
          projectId,
          title: dto.title,
          description: dto.description,
          reportedBy: userId,
          assigneeId: dto.assigneeId ?? null,
          estimateHours: dto.estimateHours ?? null,
          completedHours: dto.completedHours ?? null,
        },
        include: { reporter: PERSON_SELECT, assignee: PERSON_SELECT },
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
  async list(workspaceId: string, projectId: string) {
    await this.assertProject(workspaceId, projectId);
    return this.prisma.incident.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: PERSON_SELECT,
        assignee: PERSON_SELECT,
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
        _count: { select: { comments: true } },
      },
    });
    if (!incident) throw new NotFoundException('Incident not found');
    return incident;
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
      include: { assignee: PERSON_SELECT },
    });
    if (!incident) throw new NotFoundException('Incident not found');
    if (!incident.assignee) {
      throw new BadRequestException('Incident has no assignee to notify');
    }

    await this.mail.sendStatusNotificationEmail(incident.assignee.email, {
      entityLabel: 'incident',
      entityName: incident.title,
      projectName: project.name,
      statusName: this.formatStatus(incident.status),
    });

    return { notified: true, assignee: incident.assignee.email };
  }

  /** Notifies the project owner that a new incident was raised. Best-effort. */
  private async notifyIncidentCreated(
    project: { id: string; name: string; ownerId: string },
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
      })
      .catch((err) =>
        this.logger.error(
          `Failed to send incident created email to=${owner.email}: ${(err as Error).message}`,
        ),
      );
  }

  private async assertProject(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
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

  private formatStatus(status: string): string {
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
