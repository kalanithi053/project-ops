import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActivityLogService } from '../activity-log/activity-log.service';
import {
  AttachmentsService,
  extractAttachmentIds,
} from '../attachments/attachments.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkItemDto } from './dto/create-work-item.dto';
import { UpdateWorkItemDto } from './dto/update-work-item.dto';
import { ListWorkItemsQueryDto } from './dto/list-work-items.dto';
import {
  generateRandomId,
  POSITION_GAP,
} from '../common/constants/workspace-defaults';

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
  'position',
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

// `description` lives in its own 1:1 `work_item_detail` table (vertical
// partitioning — see the WorkItemDetail model) since it's the one large,
// optional column and only ever read by the single-item detail view. `list()`
// uses the plain WORK_ITEM_INCLUDE above so a board/list fetch never pulls it;
// this one joins it in for endpoints that operate on a single work item.
const WORK_ITEM_DETAIL_INCLUDE = {
  ...WORK_ITEM_INCLUDE,
  detail: { select: { description: true } },
} as const;

@Injectable()
export class WorkItemsService {
  private readonly logger = new Logger(WorkItemsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly mail: MailService,
    private readonly attachments: AttachmentsService,
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
      and.push({ workItemType: { category: filters.category } });
    }

    return this.prisma.workItem.findMany({
      where: { projectId, ...(and.length ? { AND: and } : {}) },
      // `position` is a flat ordering across the whole project (the Kanban
      // board renumbers it on drag) — `createdAt` only breaks ties among rows
      // that still share the `position` default of 0.
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
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
    // New items land at the end of the project's flat ordering by default,
    // spaced out so the board can insert between any two rows without a
    // rebalance for a long time.
    const nextPosition =
      dto.position ??
      ((
        await this.prisma.workItem.aggregate({
          where: { projectId },
          _max: { position: true },
        })
      )._max.position ?? -POSITION_GAP) + POSITION_GAP;

    const created = await this.prisma.$transaction(async (tx) => {
      const created = await tx.workItem.create({
        data: {
          projectId,
          moduleInstanceId: dto?.moduleInstanceId,
          workItemTypeId: dto.workItemTypeId ?? null,
          name: dto.name,
          prefix: dto.prefix ?? generateRandomId(),
          detail: { create: { description: dto.description ?? null } },
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
          position: nextPosition,
        },
        include: WORK_ITEM_DETAIL_INCLUDE,
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

    const result = this.withDescription(created);
    await this.notifyWorkItemEvent(project, result, 'created', entityType);
    return result;
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
    // Diffed against the work item's current values, not raw DTO presence —
    // the editor always resends unchanged fields (e.g. `name`), so a
    // presence check would reject a Client's status-only save outright.
    const changes = this.computeChanges(workItem, dto);
    await this.assertClientCanUpdate(projectId, userId, workItem, changes);

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
          detail:
            dto.description !== undefined
              ? {
                  upsert: {
                    create: { description: dto.description },
                    update: { description: dto.description },
                  },
                }
              : undefined,
          moduleInstanceId: dto.moduleInstanceId ?? undefined,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          statusId: dto.statusId ?? undefined,
          priorityId: dto.priorityId ?? undefined,
          assigneeId: dto.assigneeId ?? undefined,
          qaAssigneeId: dto.qaAssigneeId ?? undefined,
          estimateHours: dto.estimateHours ?? undefined,
          completedHours: dto.completedHours ?? undefined,
          position: dto.position ?? undefined,
        },
        include: WORK_ITEM_DETAIL_INCLUDE,
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

    const result = this.withDescription(updated);

    // An image the user removed from the description (kept in the DB row
    // and S3 as an inline attachment) is otherwise orphaned forever — clean
    // up whatever attachment ids dropped out between the old and new text.
    if (dto.description !== undefined) {
      const oldIds = extractAttachmentIds(workItem.description);
      const newIds = extractAttachmentIds(dto.description);
      const droppedIds = Array.from(oldIds).filter((id) => !newIds.has(id));
      if (droppedIds.length > 0) {
        await this.attachments.deleteByIds(workspaceId, droppedIds);
      }
    }

    if (assigneeChanged && result.assignee) {
      await this.notifyReassignment(project, result, userId, entityType);
    }
    if (Object.keys(changes).length > 0) {
      const statusChanged = Boolean(changes.statusId);
      await this.notifyWorkItemEvent(
        project,
        result,
        statusChanged ? 'status_changed' : 'updated',
        entityType,
        {
          skipAssignee: assigneeChanged,
          ...(statusChanged
            ? { fromStatus: workItem.status, toStatus: result.status }
            : {}),
        },
      );
    }
    return result;
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

  /** Work items due within this many days count as "due soon" rather than merely on the radar. */
  private static readonly DUE_SOON_WINDOW_DAYS = 3;

  /** How many of the workspace's top priority tiers count as "high priority" (see getPriorityItems). */
  private static readonly TOP_PRIORITY_TIER_COUNT = 2;

  /** Shared select for the dashboard's attention/priority/"my open items" endpoints. */
  private static readonly INSIGHT_SELECT = {
    id: true,
    name: true,
    prefix: true,
    dueDate: true,
    project: { select: { id: true, name: true } },
    status: { select: { name: true, category: true, color: true } },
    priority: { select: { id: true, name: true, color: true, order: true } },
    workItemType: { select: { id: true, name: true, category: true, color: true } },
  } as const;

  /** Same as INSIGHT_SELECT plus the assignee — the team-wide (Owner/Admin/Client) variants need to show who owns each item. */
  private static readonly TEAM_INSIGHT_SELECT = {
    ...WorkItemsService.INSIGHT_SELECT,
    assignee: {
      select: { id: true, email: true, firstName: true, lastName: true },
    },
  } as const;

  /**
   * The signed-in user's own work items that need attention: overdue,
   * due soon, or blocked — excluding anything already done/removed.
   * Sorted so the most overdue items lead, blocked-but-not-yet-due last
   * (Postgres' default ASC ordering already puts null due dates last).
   */
  async getAttentionItems(workspaceId: string, userId: string) {
    const now = new Date();
    const dueSoonCutoff = new Date(
      now.getTime() +
        WorkItemsService.DUE_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    const items = await this.prisma.workItem.findMany({
      where: {
        assigneeId: userId,
        project: { workspaceId, deletedAt: null },
        status: { is: { category: { notIn: ['done', 'removed'] } } },
        OR: [
          { dueDate: { lte: dueSoonCutoff } },
          { status: { is: { category: 'blocked' } } },
        ],
      },
      select: WorkItemsService.INSIGHT_SELECT,
      orderBy: [{ dueDate: 'asc' }],
    });

    return {
      total: items.length,
      items: items.map((item) => {
        const overdue = Boolean(item.dueDate && item.dueDate < now);
        const dueSoon = !overdue && Boolean(item.dueDate);
        return {
          ...item,
          reason: overdue
            ? ('overdue' as const)
            : dueSoon
              ? ('due_soon' as const)
              : ('blocked' as const),
        };
      }),
    };
  }

  /**
   * Every work item in the workspace (optionally narrowed to one project)
   * that needs attention, across every assignee — the Owner/Admin/Client
   * "team" view. Same overdue/due-soon/blocked rules as getAttentionItems,
   * just without the assigneeId filter.
   */
  async getTeamAttentionItems(workspaceId: string, projectId?: string) {
    const now = new Date();
    const dueSoonCutoff = new Date(
      now.getTime() +
        WorkItemsService.DUE_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    const items = await this.prisma.workItem.findMany({
      where: {
        project: { workspaceId, deletedAt: null, ...(projectId && { id: projectId }) },
        status: { is: { category: { notIn: ['done', 'removed'] } } },
        OR: [
          { dueDate: { lte: dueSoonCutoff } },
          { status: { is: { category: 'blocked' } } },
        ],
      },
      select: WorkItemsService.TEAM_INSIGHT_SELECT,
      orderBy: [{ dueDate: 'asc' }],
    });

    return {
      total: items.length,
      items: items.map(({ assignee, ...item }) => {
        const overdue = Boolean(item.dueDate && item.dueDate < now);
        const dueSoon = !overdue && Boolean(item.dueDate);
        return {
          ...item,
          reason: overdue
            ? ('overdue' as const)
            : dueSoon
              ? ('due_soon' as const)
              : ('blocked' as const),
          assignee: this.mapAssigneeRef(assignee),
        };
      }),
    };
  }

  /** The ids of the workspace's top N priority tiers (highest `order` first) — e.g. High + Urgent. */
  private async getTopPriorityIds(workspaceId: string): Promise<string[]> {
    const priorities = await this.prisma.priority.findMany({
      where: { workspaceId },
      orderBy: { order: 'desc' },
      select: { id: true },
      take: WorkItemsService.TOP_PRIORITY_TIER_COUNT,
    });
    return priorities.map((p) => p.id);
  }

  /**
   * The signed-in user's own open work items that sit in the workspace's
   * top priority tiers (High/Urgent, however they're named) — most urgent
   * first, then due date. Powers the dashboard's priority list. Fetched
   * unsorted-by-DB and ranked in JS since a per-user backlog is small and
   * "no due date" needs to sort last, which Postgres' default null
   * placement won't do consistently across ASC and DESC.
   */
  async getPriorityItems(workspaceId: string, userId: string, limit = 10) {
    const topPriorityIds = await this.getTopPriorityIds(workspaceId);
    if (!topPriorityIds.length) return { total: 0, items: [] };

    const items = await this.prisma.workItem.findMany({
      where: {
        assigneeId: userId,
        project: { workspaceId, deletedAt: null },
        status: { is: { category: { notIn: ['done', 'removed'] } } },
        priorityId: { in: topPriorityIds },
      },
      select: WorkItemsService.INSIGHT_SELECT,
    });

    const ranked = items.sort((a, b) => {
      const priorityDiff =
        (b.priority?.order ?? -1) - (a.priority?.order ?? -1);
      if (priorityDiff !== 0) return priorityDiff;
      const aDue = a.dueDate?.getTime() ?? Infinity;
      const bDue = b.dueDate?.getTime() ?? Infinity;
      return aDue - bDue;
    });

    return { total: ranked.length, items: ranked.slice(0, limit) };
  }

  /**
   * Every open work item in the workspace's (optionally one project's) top
   * priority tiers, across every assignee — the Owner/Admin/Client "team"
   * view of getPriorityItems.
   */
  async getTeamPriorityItems(
    workspaceId: string,
    projectId?: string,
    limit = 10,
  ) {
    const topPriorityIds = await this.getTopPriorityIds(workspaceId);
    if (!topPriorityIds.length) return { total: 0, items: [] };

    const items = await this.prisma.workItem.findMany({
      where: {
        project: { workspaceId, deletedAt: null, ...(projectId && { id: projectId }) },
        status: { is: { category: { notIn: ['done', 'removed'] } } },
        priorityId: { in: topPriorityIds },
      },
      select: WorkItemsService.TEAM_INSIGHT_SELECT,
    });

    const ranked = items.sort((a, b) => {
      const priorityDiff =
        (b.priority?.order ?? -1) - (a.priority?.order ?? -1);
      if (priorityDiff !== 0) return priorityDiff;
      const aDue = a.dueDate?.getTime() ?? Infinity;
      const bDue = b.dueDate?.getTime() ?? Infinity;
      return aDue - bDue;
    });

    return {
      total: ranked.length,
      items: ranked.slice(0, limit).map(({ assignee, ...item }) => ({
        ...item,
        assignee: this.mapAssigneeRef(assignee),
      })),
    };
  }

  /** Shapes a nested assignee relation into the compact ref the team dashboard views return. */
  private mapAssigneeRef(
    assignee: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
    } | null,
  ) {
    return assignee
      ? {
          id: assignee.id,
          email: assignee.email,
          name: this.displayName(assignee),
        }
      : null;
  }

  /**
   * Every open work item assigned to the signed-in user, regardless of
   * priority — the source list for the dashboard's quick time-log timer
   * picker (logging time isn't gated by how urgent the item is).
   */
  async getMyOpenItems(workspaceId: string, userId: string) {
    const items = await this.prisma.workItem.findMany({
      where: {
        assigneeId: userId,
        project: { workspaceId, deletedAt: null },
        status: { is: { category: { notIn: ['done', 'removed'] } } },
      },
      select: WorkItemsService.INSIGHT_SELECT,
      orderBy: [{ dueDate: 'asc' }],
    });

    return { total: items.length, items };
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
    return this.displayName(user);
  }

  private displayName(user: {
    email: string;
    firstName: string | null;
    lastName: string | null;
  }): string {
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

  /**
   * The Client role holds WORKITEM_UPDATE (see DEFAULT_ROLES), but only so a
   * client who is the assignee or QA assignee on a work item can move its
   * status — not edit any other field, and not on items they aren't on.
   * Every other role's project role already gates WORKITEM_UPDATE at the
   * permission-catalog level, so this only narrows the Client case further.
   *
   * `position` is allowed alongside `statusId`: the Kanban board's drag
   * handler always PATCHes both together (even a same-column reorder shifts
   * the gap-based position value) — see task-board.tsx's handleDragEnd. It's
   * a side effect of moving the card, not a distinct field edit.
   */
  private static readonly CLIENT_ALLOWED_UPDATE_FIELDS: readonly string[] = [
    'statusId',
    'position',
  ];

  private async assertClientCanUpdate(
    projectId: string,
    userId: string,
    workItem: { assigneeId: string | null; qaAssigneeId: string | null },
    changes: Record<string, { from: unknown; to: unknown }>,
  ) {
    const membership = await this.prisma.projectMember.findFirst({
      where: { projectId, userId, status: { not: 'removed' } },
      select: { role: { select: { name: true } } },
    });
    if (membership?.role.name !== 'Client') return;

    const isAssigneeOrQa =
      workItem.assigneeId === userId || workItem.qaAssigneeId === userId;
    if (!isAssigneeOrQa) {
      throw new ForbiddenException(
        'Clients can only update the status of work items where they are the assignee or QA assignee.',
      );
    }

    const otherFieldsChanged = Object.keys(changes).some(
      (field) => !WorkItemsService.CLIENT_ALLOWED_UPDATE_FIELDS.includes(field),
    );
    if (otherFieldsChanged) {
      throw new ForbiddenException("Clients can only change a work item's status.");
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
      include: WORK_ITEM_DETAIL_INCLUDE,
    });
    if (!workItem) throw new NotFoundException('Work item not found');
    return this.withDescription(workItem);
  }

  /**
   * Flattens the joined `detail.description` back onto the top level —
   * matching the API's pre-partition shape — and drops the nested `detail`
   * key from the response.
   */
  private withDescription<
    T extends { detail?: { description: string | null } | null },
  >(workItem: T): Omit<T, 'detail'> & { description: string | null } {
    const { detail, ...rest } = workItem;
    return { ...rest, description: detail?.description ?? null };
  }
}
