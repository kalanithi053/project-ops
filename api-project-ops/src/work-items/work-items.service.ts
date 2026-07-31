import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkItemDto } from './dto/create-work-item.dto';
import { UpdateWorkItemDto } from './dto/update-work-item.dto';
import { ListWorkItemsQueryDto } from './dto/list-work-items.dto';
import { generateRandomId } from 'src/common/constants/workspace-defaults';

/** Matches the Kanban board's "No status" column — see task-board.tsx's UNASSIGNED. */
const UNASSIGNED_STATUS = '__unassigned__';

const WORK_ITEM_UPDATE_FIELDS = [
  'name',
  'prefix',
  'workItemTypeId',
  'description',
  'moduleInstanceId',
  'startDate',
  'dueDate',
  'statusId',
  'priorityId',
  'assigneeId',
  'qaAssigneeId',
  'estimateHours',
  'completedHours',
] as const;

/** Fallback activity log entityType when the work item has no WorkType set. */
const DEFAULT_ENTITY_TYPE = 'task';

const WORK_ITEM_INCLUDE = {
  workItemType: {
    select: { id: true, name: true, category: true, color: true },
  },
  status: { select: { id: true, name: true, category: true, color: true } },
  priority: { select: { id: true, name: true, color: true } },
  assignee: { select: { id: true, email: true } },
  qaAssignee: { select: { id: true, email: true } },
  creator: { select: { id: true, email: true } },
} as const;

@Injectable()
export class WorkItemsService {
  private readonly logger = new Logger(WorkItemsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly mail: MailService,
  ) {}

  async list(
    workspaceId: string,
    projectId: string,
    filters: ListWorkItemsQueryDto = {},
  ) {
    await this.assertProject(workspaceId, projectId);

    const moduleInstanceIds = new Set(filters.moduleInstanceIds ?? []);
    if (filters.moduleInstanceId)
      moduleInstanceIds.add(filters.moduleInstanceId);

    const and: Prisma.WorkItemWhereInput[] = [];
    if (filters.search) {
      and.push({
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { prefix: { contains: filters.search, mode: 'insensitive' } },
        ],
      });
    }
    if (filters.assigneeIds?.length) {
      and.push({ assigneeId: { in: filters.assigneeIds } });
    }
    if (moduleInstanceIds.size) {
      and.push({ moduleInstanceId: { in: [...moduleInstanceIds] } });
    }
    if (filters.priorityId) and.push({ priorityId: filters.priorityId });
    const statusFilter = this.buildStatusFilter(
      filters.statusId,
      filters.statusIds,
    );
    if (statusFilter) and.push(statusFilter);
    if (filters.startDate) {
      and.push({ startDate: { gte: new Date(filters.startDate) } });
    }
    if (filters.endDate) {
      and.push({ dueDate: { lte: new Date(filters.endDate) } });
    }
    if (filters.category) {
      and.push(
        filters.category === DEFAULT_ENTITY_TYPE
          ? {
              OR: [
                { workItemTypeId: null },
                { workItemType: { category: filters.category } },
              ],
            }
          : { workItemType: { category: filters.category } },
      );
    }

    return this.prisma.workItem.findMany({
      where: { projectId, ...(and.length ? { AND: and } : {}) },
      orderBy: { createdAt: 'asc' },
      include: WORK_ITEM_INCLUDE,
    });
  }

  /** Combines the board's single `statusId` and the list's `statusIds`, translating the
   * "__unassigned__" sentinel into a `statusId: null` match. */
  private buildStatusFilter(
    statusId?: string,
    statusIds?: string[],
  ): Prisma.WorkItemWhereInput | undefined {
    const ids = new Set<string>();
    let includeUnassigned = false;
    for (const value of [statusId, ...(statusIds ?? [])]) {
      if (!value) continue;
      if (value === UNASSIGNED_STATUS) includeUnassigned = true;
      else ids.add(value);
    }
    if (!ids.size && !includeUnassigned) return undefined;
    if (includeUnassigned && ids.size) {
      return { OR: [{ statusId: { in: [...ids] } }, { statusId: null }] };
    }
    return includeUnassigned
      ? { statusId: null }
      : { statusId: { in: [...ids] } };
  }

  async findOne(workspaceId: string, projectId: string, id: string) {
    return this.getWorkItem(workspaceId, projectId, id);
  }

  async create(
    workspaceId: string,
    projectId: string,
    userId: string,
    dto: CreateWorkItemDto,
  ) {
    const project = await this.assertProject(workspaceId, projectId);

    let workType: Awaited<ReturnType<typeof this.assertWorkType>> | undefined;
    if (dto.workItemTypeId) {
      workType = await this.assertWorkType(workspaceId, dto.workItemTypeId);
    }
    if (workType?.category === 'task') {
      if (!dto.moduleInstanceId) {
        throw new BadRequestException(
          'moduleInstanceId is required for task work items',
        );
      }
      await this.assertModuleInstance(projectId, dto.moduleInstanceId);
    }
    if (dto.statusId) await this.assertStatus(workspaceId, dto.statusId);
    if (dto.priorityId) await this.assertPriority(workspaceId, dto.priorityId);
    if (dto.assigneeId) await this.assertAssignee(workspaceId, dto.assigneeId);
    if (dto.qaAssigneeId) {
      await this.assertAssignee(workspaceId, dto.qaAssigneeId);
    }
    const defaultPriority =
      dto.priorityId ??
      (
        await this.prisma.priority.findFirst({
          where: { workspaceId, isDefault: true },
        })
      )?.id;
    const defaultStatus =
      dto.statusId ??
      (
        await this.prisma.ticketStatus.findFirst({
          where: { workspaceId, isDefault: true },
        })
      )?.id;
    const entityType = await this.resolveEntityType(
      workspaceId,
      dto.workItemTypeId,
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const created = await tx.workItem.create({
        data: {
          projectId,
          moduleInstanceId: dto?.moduleInstanceId,
          workItemTypeId: dto.workItemTypeId ?? null,
          name: dto.name,
          prefix: dto.prefix ?? generateRandomId(),
          description: dto.description ?? null,
          startDate: dto.startDate
            ? new Date(dto.startDate)
            : project.startDate
              ? new Date(project.startDate)
              : null,
          dueDate: dto.dueDate
            ? new Date(dto.dueDate)
            : project.endDate
              ? new Date(project.endDate)
              : null,
          statusId: defaultStatus ?? null,
          priorityId: defaultPriority ?? null,
          assigneeId: dto.assigneeId ?? userId ?? null,
          qaAssigneeId: dto.qaAssigneeId ?? null,
          createdBy: userId,
          estimateHours: dto.estimateHours ?? null,
          completedHours: dto.completedHours ?? null,
        },
        include: WORK_ITEM_INCLUDE,
      });

      await this.activityLog.log(
        {
          workspaceId,
          projectId,
          entityType,
          entityId: created.id,
          action: 'created',
          userId,
          metadata: {
            name: created.name,
            statusId: created.statusId,
            assigneeId: created.assigneeId,
            qaAssigneeId: created.qaAssigneeId,
          },
        },
        tx,
      );

      return created;
    });

    await this.notifyWorkItemEvent(project, created, 'created', entityType);
    return created;
  }

  async update(
    workspaceId: string,
    projectId: string,
    id: string,
    userId: string,
    dto: UpdateWorkItemDto,
  ) {
    const project = await this.assertProject(workspaceId, projectId);
    const workItem = await this.getWorkItem(workspaceId, projectId, id);

    if (dto.moduleInstanceId) {
      await this.assertModuleInstance(projectId, dto.moduleInstanceId);
    }
    if (dto.workItemTypeId) {
      await this.assertWorkType(workspaceId, dto.workItemTypeId);
    }
    if (dto.statusId) await this.assertStatus(workspaceId, dto.statusId);
    if (dto.priorityId) await this.assertPriority(workspaceId, dto.priorityId);
    if (dto.assigneeId) await this.assertAssignee(workspaceId, dto.assigneeId);
    if (dto.qaAssigneeId) {
      await this.assertAssignee(workspaceId, dto.qaAssigneeId);
    }

    const changes = this.computeChanges(workItem, dto);
    const entityType = await this.resolveEntityType(
      workspaceId,
      dto.workItemTypeId ?? workItem.workItemTypeId,
    );
    const assigneeChanged =
      dto.assigneeId !== undefined && dto.assigneeId !== workItem.assigneeId;

    const updated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.workItem.update({
        where: { id },
        data: {
          name: dto.name ?? undefined,
          prefix: dto.prefix ?? undefined,
          workItemTypeId: dto.workItemTypeId ?? undefined,
          description: dto.description ?? undefined,
          moduleInstanceId: dto.moduleInstanceId ?? undefined,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          statusId: dto.statusId ?? undefined,
          priorityId: dto.priorityId ?? undefined,
          assigneeId: dto.assigneeId ?? undefined,
          qaAssigneeId: dto.qaAssigneeId ?? undefined,
          estimateHours: dto.estimateHours ?? undefined,
          completedHours: dto.completedHours ?? undefined,
        },
        include: WORK_ITEM_INCLUDE,
      });

      if (Object.keys(changes).length > 0) {
        await this.activityLog.log(
          {
            workspaceId,
            projectId,
            entityType,
            entityId: id,
            action: 'updated',
            userId,
            metadata: { changes },
          },
          tx,
        );
      }

      return updated;
    });

    if (assigneeChanged && updated.assignee) {
      await this.notifyReassignment(project, updated, userId, entityType);
    }
    if (Object.keys(changes).length > 0) {
      const statusChanged = Boolean(changes.statusId);
      await this.notifyWorkItemEvent(
        project,
        updated,
        statusChanged ? 'status_changed' : 'updated',
        entityType,
        {
          skipAssignee: assigneeChanged,
          ...(statusChanged
            ? { fromStatus: workItem.status, toStatus: updated.status }
            : {}),
        },
      );
    }
    return updated;
  }

  async remove(workspaceId: string, projectId: string, id: string) {
    await this.getWorkItem(workspaceId, projectId, id);
    await this.prisma.workItem.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** Activity log entries for one work item, oldest first. */
  async getActivity(workspaceId: string, projectId: string, id: string) {
    await this.getWorkItem(workspaceId, projectId, id);
    return this.activityLog.getTimeline(workspaceId, id);
  }

  /** On-demand nudge — emails the assignee a reminder about this work item. */
  async notifyAssignee(workspaceId: string, projectId: string, id: string) {
    const project = await this.assertProject(workspaceId, projectId);
    const workItem = await this.getWorkItem(workspaceId, projectId, id);
    if (!workItem.assignee) {
      throw new BadRequestException('Work item has no assignee to notify');
    }

    const entityType = workItem.workItemType?.category ?? DEFAULT_ENTITY_TYPE;
    const workItemName = workItem.prefix
      ? `${workItem.prefix} · ${workItem.name}`
      : workItem.name;

    await this.mail.sendWorkItemNotificationEmail(workItem.assignee.email, {
      action: 'reminder',
      entityType,
      workItemName,
      projectName: project.name,
      actionUrl: this.mail.appUrl(
        `/${project.workspace.slug}/projects/${projectId}/work-items/${id}`,
      ),
    });

    return { notified: true, assignee: workItem.assignee.email };
  }

  // --- helpers ---

  private async assertProject(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
      include: {
        owner: { select: { id: true, email: true } },
        workspace: { select: { slug: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  /**
   * Emails the project owner, assignee, and QA assignee (deduped) about a
   * work item create/update. Best-effort — a mail failure never fails the
   * work item mutation itself.
   */
  private async notifyWorkItemEvent(
    project: {
      id: string;
      name: string;
      owner: { id: string; email: string };
      workspace: { slug: string };
    },
    workItem: {
      id: string;
      name: string;
      prefix: string | null;
      assignee: { id: string; email: string } | null;
      qaAssignee: { id: string; email: string } | null;
    },
    action: 'created' | 'updated' | 'status_changed',
    entityType: string,
    options?: {
      skipAssignee?: boolean;
      fromStatus?: { name: string; color: string | null } | null;
      toStatus?: { name: string; color: string | null } | null;
    },
  ) {
    const recipients = new Map<string, string>([
      [project.owner.id, project.owner.email],
    ]);
    if (workItem.assignee && !options?.skipAssignee) {
      recipients.set(workItem.assignee.id, workItem.assignee.email);
    }
    if (workItem.qaAssignee) {
      recipients.set(workItem.qaAssignee.id, workItem.qaAssignee.email);
    }

    const workItemName = workItem.prefix
      ? `${workItem.prefix} · ${workItem.name}`
      : workItem.name;
    const actionUrl = this.mail.appUrl(
      `/${project.workspace.slug}/projects/${project.id}/work-items/${workItem.id}`,
    );

    await Promise.all(
      [...recipients.values()].map((email) =>
        this.mail
          .sendWorkItemNotificationEmail(email, {
            action,
            entityType,
            workItemName,
            projectName: project.name,
            actionUrl,
            ...(options?.fromStatus ? { fromStatus: options.fromStatus } : {}),
            ...(options?.toStatus ? { toStatus: options.toStatus } : {}),
          })
          .catch((error) =>
            this.logger.error(
              `Failed to send work item ${action} email to=${email}: ${(error as Error).message}`,
            ),
          ),
      ),
    );
  }

  /** Emails the new assignee that they were reassigned, naming who did it. */
  private async notifyReassignment(
    project: {
      id: string;
      name: string;
      workspace: { slug: string };
    },
    workItem: {
      id: string;
      name: string;
      prefix: string | null;
      assignee: { id: string; email: string } | null;
    },
    actorUserId: string,
    entityType: string,
  ) {
    if (!workItem.assignee) return;

    const actorName = await this.resolveActorName(actorUserId);
    const workItemName = workItem.prefix
      ? `${workItem.prefix} · ${workItem.name}`
      : workItem.name;

    await this.mail
      .sendWorkItemNotificationEmail(workItem.assignee.email, {
        action: 'assigned',
        entityType,
        workItemName,
        projectName: project.name,
        actorName,
        actionUrl: this.mail.appUrl(
          `/${project.workspace.slug}/projects/${project.id}/work-items/${workItem.id}`,
        ),
      })
      .catch((error) =>
        this.logger.error(
          `Failed to send reassignment email to=${workItem.assignee?.email}: ${(error as Error).message}`,
        ),
      );
  }

  /** Never surfaces a raw email — falls back to its local-part (e.g. "jane"). */
  private async resolveActorName(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    });
    if (!user) return 'Someone';
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
    return name || user.email.split('@')[0];
  }

  private async assertModuleInstance(
    projectId: string,
    moduleInstanceId: string,
  ) {
    if (!moduleInstanceId) throw new BadRequestException('Module is required');
    const instance = await this.prisma.moduleInstance.findFirst({
      where: { id: moduleInstanceId, projectId },
    });
    if (!instance) {
      throw new BadRequestException('Module instance not found in project');
    }
  }

  private async assertWorkType(workspaceId: string, workItemTypeId: string) {
    const workType = await this.prisma.workType.findFirst({
      where: { id: workItemTypeId, workspaceId },
    });
    if (!workType) {
      throw new BadRequestException('Work type not found in workspace');
    }
    return workType;
  }

  private async assertStatus(workspaceId: string, statusId: string) {
    const status = await this.prisma.ticketStatus.findFirst({
      where: { id: statusId, workspaceId },
    });
    if (!status) {
      throw new BadRequestException('Status not found in workspace');
    }
  }

  private async assertPriority(workspaceId: string, priorityId: string) {
    const priority = await this.prisma.priority.findFirst({
      where: { id: priorityId, workspaceId },
    });
    if (!priority) {
      throw new BadRequestException('Priority not found in workspace');
    }
  }

  private async assertAssignee(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId, status: { not: 'removed' } },
    });
    if (!member) {
      throw new BadRequestException('Assignee is not a workspace member');
    }
  }

  /** Resolves the activity log entityType from the referenced WorkType's category. */
  private async resolveEntityType(
    workspaceId: string,
    workItemTypeId?: string | null,
  ): Promise<string> {
    if (!workItemTypeId) return DEFAULT_ENTITY_TYPE;
    const workType = await this.prisma.workType.findFirst({
      where: { id: workItemTypeId, workspaceId },
      select: { category: true },
    });
    return workType?.category ?? DEFAULT_ENTITY_TYPE;
  }

  /** Diffs a patch against the current work item, field by field, for the audit log. */
  private computeChanges(
    workItem: Record<string, unknown>,
    dto: UpdateWorkItemDto,
  ): Record<string, { from: unknown; to: unknown }> {
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const field of WORK_ITEM_UPDATE_FIELDS) {
      const patchValue = dto[field];
      if (patchValue === undefined) continue;

      const isDateField = field === 'startDate' || field === 'dueDate';
      const before = isDateField
        ? ((workItem[field] as Date | null)?.toISOString() ?? null)
        : workItem[field];
      const after = isDateField
        ? new Date(patchValue).toISOString()
        : patchValue;

      if (before !== after) {
        changes[field] = { from: before, to: after };
      }
    }
    return changes;
  }

  private async getWorkItem(
    workspaceId: string,
    projectId: string,
    id: string,
  ) {
    await this.assertProject(workspaceId, projectId);
    const workItem = await this.prisma.workItem.findFirst({
      where: { id, projectId },
      include: WORK_ITEM_INCLUDE,
    });
    if (!workItem) throw new NotFoundException('Work item not found');
    return workItem;
  }
}
