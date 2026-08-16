import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ActivityEntityType = string;

export interface LogActivityParams {
  workspaceId: string;
  projectId?: string;
  entityType: ActivityEntityType;
  entityId: string;
  action: string;
  userId: string;
  metadata?: Record<string, unknown>;
}

interface NamedUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

/** Never surfaces a raw email — falls back to its local-part (e.g. "jane"). */
function displayName(user: NamedUser | null | undefined): string {
  if (!user) return 'Someone';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return name || user.email.split('@')[0];
}

/**
 * Generic audit trail. `log()` accepts either the default PrismaService or a
 * `$transaction` callback client, so callers can write the log entry
 * atomically alongside the mutation it records.
 */
@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    params: LogActivityParams,
    client: PrismaClient | Prisma.TransactionClient = this.prisma,
  ) {
    return client.activityLog.create({
      data: {
        workspaceId: params.workspaceId,
        projectId: params.projectId ?? null,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        userId: params.userId,
        metadata: params.metadata as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * A human-readable timeline for one entity, oldest first. When `entityType`
   * is omitted, entries are matched by `entityId` alone (a task/incident id
   * is only ever one or the other, so this is enough to look it up without
   * the caller knowing which kind of entity it is).
   */
  async getTimeline(
    workspaceId: string,
    entityId: string,
    entityType?: ActivityEntityType,
  ) {
    const logs = await this.prisma.activityLog.findMany({
      where: { workspaceId, entityId, entityType },
      orderBy: { createdAt: 'asc' },
      include: {
        actor: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
    if (logs.length === 0) return [];

    return this.describeEntries(workspaceId, logs);
  }

  /**
   * One page of a timeline, newest first (unlike getTimeline, which is
   * oldest first), plus the total count so callers can tell whether more
   * pages remain.
   */
  async getTimelinePage(
    workspaceId: string,
    entityId: string,
    entityType: ActivityEntityType | undefined,
    { skip, take }: { skip: number; take: number },
  ) {
    const where = { workspaceId, entityId, entityType };
    const [logs, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
        skip,
        take,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    const items = logs.length ? await this.describeEntries(workspaceId, logs) : [];
    return { items, total };
  }

  /** Resolves lookups once for a batch of log rows and maps each to a described entry. */
  private async describeEntries(
    workspaceId: string,
    logs: Array<{
      id: string;
      entityType: string;
      entityId: string;
      action: string;
      actor: NamedUser | null;
      createdAt: Date;
      metadata: unknown;
    }>,
  ) {
    const lookups = await this.buildLookups(workspaceId, logs);

    return logs.map((entry) => {
      const actorName = displayName(entry.actor);
      return {
        id: entry.id,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        actor: actorName,
        createdAt: entry.createdAt,
        description: this.describeEntry(entry, lookups, actorName),
        metadata: entry.metadata,
      };
    });
  }

  /** Resolves every statusId/priorityId/userId referenced across the given
   * entries in a handful of batched queries, so descriptions can show names
   * instead of raw ids. */
  private async buildLookups(
    workspaceId: string,
    logs: Array<{ metadata: unknown }>,
  ) {
    const statusIds = new Set<string>();
    const priorityIds = new Set<string>();
    const userIds = new Set<string>();

    for (const log of logs) {
      const meta = (log.metadata ?? {}) as Record<string, unknown>;
      if (typeof meta.statusId === 'string') statusIds.add(meta.statusId);
      if (typeof meta.from === 'string') statusIds.add(meta.from);
      if (typeof meta.to === 'string') statusIds.add(meta.to);
      if (typeof meta.assigneeId === 'string') userIds.add(meta.assigneeId);

      const changes = (meta.changes ?? {}) as Record<
        string,
        { from: unknown; to: unknown }
      >;
      if (changes.statusId) {
        if (typeof changes.statusId.from === 'string')
          statusIds.add(changes.statusId.from);
        if (typeof changes.statusId.to === 'string')
          statusIds.add(changes.statusId.to);
      }
      if (changes.priorityId) {
        if (typeof changes.priorityId.from === 'string')
          priorityIds.add(changes.priorityId.from);
        if (typeof changes.priorityId.to === 'string')
          priorityIds.add(changes.priorityId.to);
      }
      if (changes.assigneeId) {
        if (typeof changes.assigneeId.from === 'string')
          userIds.add(changes.assigneeId.from);
        if (typeof changes.assigneeId.to === 'string')
          userIds.add(changes.assigneeId.to);
      }
    }

    const [statuses, priorities, users] = await Promise.all([
      statusIds.size
        ? this.prisma.ticketStatus.findMany({
            where: { workspaceId, id: { in: [...statusIds] } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      priorityIds.size
        ? this.prisma.priority.findMany({
            where: { workspaceId, id: { in: [...priorityIds] } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      userIds.size
        ? this.prisma.user.findMany({
            where: { id: { in: [...userIds] } },
            select: { id: true, email: true, firstName: true, lastName: true },
          })
        : Promise.resolve([]),
    ]);

    return {
      statusName: new Map(
        statuses.map((s: { id: string; name: string }) => [s.id, s.name]),
      ),
      priorityName: new Map(
        priorities.map((p: { id: string; name: string }) => [p.id, p.name]),
      ),
      userName: new Map(users.map((u: NamedUser) => [u.id, displayName(u)])),
    };
  }

  private describeEntry(
    entry: { action: string; entityType: string; metadata: unknown },
    lookups: {
      statusName: Map<string, string>;
      priorityName: Map<string, string>;
      userName: Map<string, string>;
    },
    actorName = 'Someone',
  ): string {
    const meta = (entry.metadata ?? {}) as Record<string, unknown>;
    const noun = entry.entityType === 'incident' ? 'incident' : 'task';

    switch (entry.action) {
      case 'created':
        return `${actorName} created this ${noun}`;
      case 'deleted':
        return `${actorName} deleted this ${noun}`;
      case 'comment_added':
        return `${actorName} commented: "${(meta.preview as string) ?? ''}"`;
      case 'comment_updated':
        return `${actorName} updated a comment`;
      case 'comment_deleted':
        return `${actorName} deleted a comment`;
      case 'attachment_added':
        return `${actorName} attached a file: "${(meta.fileName as string) ?? ''}"`;
      case 'attachment_deleted':
        return `${actorName} removed a file: "${(meta.fileName as string) ?? ''}"`;
      case 'time_logged': {
        const duration = this.formatMinutes(
          (meta.durationMinutes as number) ?? 0,
        );
        const note =
          typeof meta.notes === 'string' && meta.notes
            ? ` — "${meta.notes}"`
            : '';
        return `${actorName} logged ${duration}${note}`;
      }
      case 'member_invited': {
        const email = (meta.email as string) ?? 'a user';
        const roleName = (meta.roleName as string) ?? 'a member';
        return `${actorName} invited ${email} as ${roleName}`;
      }
      case 'status_changed': {
        const from = lookups.statusName.get(meta.from as string) ?? 'None';
        const to = lookups.statusName.get(meta.to as string) ?? 'None';
        return `${actorName} changed status from ${from} to ${to}`;
      }
      case 'updated': {
        const changes = (meta.changes ?? {}) as Record<
          string,
          { from: unknown; to: unknown }
        >;
        const fields = Object.keys(changes);
        if (fields.length === 0) return `${actorName} updated this ${noun}`;
        if (fields.length === 1) {
          const [field] = fields;
          return `${actorName} ${this.describeFieldChange(field, changes[field], lookups)}`;
        }
        return `${actorName} updated ${fields.map((f) => this.fieldLabel(f)).join(', ')}`;
      }
      default:
        return `${actorName} performed ${entry.action}`;
    }
  }

  /** Full verb phrase for a single changed field, e.g. "added a description". */
  private describeFieldChange(
    field: string,
    diff: { from: unknown; to: unknown },
    lookups: {
      statusName: Map<string, string>;
      priorityName: Map<string, string>;
      userName: Map<string, string>;
    },
  ): string {
    switch (field) {
      case 'statusId':
        return `changed status to ${lookups.statusName.get(diff.to as string) ?? 'None'}`;
      case 'priorityId':
        return `changed priority to ${lookups.priorityName.get(diff.to as string) ?? 'None'}`;
      case 'assigneeId':
        return diff.to
          ? `assigned it to ${lookups.userName.get(diff.to as string) ?? 'someone'}`
          : 'removed the assignee';
      case 'description':
        return diff.from ? 'updated the description' : 'added a description';
      case 'name':
        return `renamed it to "${diff.to as string}"`;
      case 'prefix':
        return `changed the prefix to "${diff.to as string}"`;
      case 'moduleInstanceId':
        return 'moved it to a different module';
      case 'position':
        return 'reordered it';
      case 'startDate':
        return 'changed the start date';
      case 'dueDate':
        return 'changed the due date';
      case 'estimateHours':
        return `set the estimate to ${diff.to as number}h`;
      case 'completedHours':
        return `logged ${diff.to as number}h completed`;
      default:
        return `updated ${field}`;
    }
  }

  /** Minutes as "1h 30m" (or just "2h" / "45m" when one part is zero) — mirrors formatDurationMinutes in the frontend's lib/format.ts. */
  private formatMinutes(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours && mins) return `${hours}h ${mins}m`;
    if (hours) return `${hours}h`;
    return `${mins}m`;
  }

  /** Short noun label for a field, used when several changed in one update. */
  private fieldLabel(field: string): string {
    switch (field) {
      case 'statusId':
        return 'status';
      case 'priorityId':
        return 'priority';
      case 'assigneeId':
        return 'assignee';
      case 'moduleInstanceId':
        return 'module';
      case 'startDate':
        return 'start date';
      case 'dueDate':
        return 'due date';
      case 'estimateHours':
        return 'estimate';
      case 'completedHours':
        return 'completed hours';
      default:
        return field;
    }
  }
}
