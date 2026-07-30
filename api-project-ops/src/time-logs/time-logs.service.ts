import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TimeLogBillingType, TimeLogSource } from '@prisma/client';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  resolveTimeLogPreferences,
  subtractUnit,
} from '../common/constants/time-log-preferences';
import { CreateTimeLogDto } from './dto/create-time-log.dto';
import { UpdateTimeLogDto } from './dto/update-time-log.dto';
import { ListTimeLogsDto } from './dto/list-time-logs.dto';

/** Fallback activity log entityType when the work item has no WorkType set — mirrors work-items.service.ts. */
const DEFAULT_ENTITY_TYPE = 'task';

/** Truncates freeform notes before they're stored in an activity log's JSON metadata. */
function notePreview(notes: string, maxLength = 200): string {
  return notes.trim().slice(0, maxLength);
}

/** Where-clause excluding the currently in-progress timer row (0 minutes, no end time yet). */
const EXCLUDE_RUNNING_TIMER: Prisma.TimeLogWhereInput = {
  NOT: { source: TimeLogSource.timer, endTime: null },
};

const TIME_LOG_INCLUDE = {
  user: { select: { id: true, email: true, firstName: true, lastName: true } },
} as const;

const CSV_COLUMNS = [
  'Date',
  'User',
  'Work item',
  'Duration (hours)',
  'Start',
  'End',
  'Billing',
  'Notes',
] as const;

/** Never surfaces a raw email — falls back to its local-part (e.g. "jane"). */
function displayName(user: {
  email: string;
  firstName: string | null;
  lastName: string | null;
}): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return name || user.email.split('@')[0];
}

/** Minutes as decimal hours, e.g. 90 -> "1.50". */
function minutesToHours(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

/** A UTC timestamp as "dd/mm/yyyy hh:mm a", e.g. "05/03/2026 02:30 pm". */
function formatCsvDateTime(date: Date | null): string {
  if (!date) return '';
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const period = date.getUTCHours() >= 12 ? 'pm' : 'am';
  const hour12 = String(date.getUTCHours() % 12 || 12).padStart(2, '0');
  return `${day}/${month}/${year} ${hour12}:${minutes} ${period}`;
}

/**
 * Minimal CSV writer — quotes/escapes only the handful of characters that
 * matter. `summary` renders as label/value lines above a blank separator row,
 * ahead of the CSV_COLUMNS header and data rows.
 */
function toCsv(rows: string[][], summary: Array<[string, string]>): string {
  const escape = (value: string) =>
    /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  const summaryLines = summary.map(([label, value]) =>
    [label, value].map(escape).join(','),
  );
  const tableLines = [Array.from(CSV_COLUMNS), ...rows].map((row) =>
    row.map(escape).join(','),
  );
  return [...summaryLines, '', ...tableLines].join('\r\n');
}

@Injectable()
export class TimeLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  /**
   * The caller's own running timer, if any, regardless of which work item or
   * workspace it belongs to — powers the always-visible header widget so it
   * doesn't need a specific project/work-item route to know a timer is live.
   */
  async getMyRunningTimer(userId: string) {
    const running = await this.prisma.timeLog.findFirst({
      where: { userId, endTime: null, source: TimeLogSource.timer },
      include: {
        workItem: { select: { id: true, name: true, prefix: true } },
        project: { select: { workspace: { select: { slug: true } } } },
      },
    });
    if (!running) return null;

    const { project, ...timeLog } = running;
    return { ...timeLog, workspaceSlug: project.workspace.slug };
  }

  /** Entries for one work item, plus the caller's running timer (if any). */
  async listForWorkItem(
    workspaceId: string,
    projectId: string,
    workItemId: string,
    userId: string,
  ) {
    await this.assertWorkItem(workspaceId, projectId, workItemId);

    const [entries, runningTimer] = await Promise.all([
      this.prisma.timeLog.findMany({
        where: { workItemId, ...EXCLUDE_RUNNING_TIMER },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: TIME_LOG_INCLUDE,
      }),
      this.prisma.timeLog.findFirst({
        where: { workItemId, userId, endTime: null, source: TimeLogSource.timer },
      }),
    ]);

    return { entries, runningTimer };
  }

  /** Manual entry — assignee only. */
  async create(
    workspaceId: string,
    projectId: string,
    workItemId: string,
    userId: string,
    dto: CreateTimeLogDto,
  ) {
    const workItem = await this.assertWorkItem(
      workspaceId,
      projectId,
      workItemId,
    );
    this.assertAssignee(workItem, userId);

    const preferences = await this.getPreferences(workspaceId);
    if (!preferences.allowManualTimeLog) {
      throw new ForbiddenException(
        'Manual time log entries are disabled for this workspace. Use the timer instead.',
      );
    }
    this.assertLogDateAllowed(preferences, dto.date);

    const { startTime, endTime, durationMinutes } = this.resolvePeriod(dto);
    const entityType = await this.resolveEntityType(
      workspaceId,
      workItem.workItemTypeId,
    );

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.timeLog.create({
        data: {
          workspaceId,
          projectId,
          workItemId,
          userId,
          date: new Date(dto.date),
          startTime,
          endTime,
          durationMinutes,
          billingType: dto.billingType ?? TimeLogBillingType.billable,
          notes: dto.notes ?? null,
          source: 'manual',
        },
        include: TIME_LOG_INCLUDE,
      });

      await this.activityLog.log(
        {
          workspaceId,
          projectId,
          entityType,
          entityId: workItemId,
          action: 'time_logged',
          userId,
          metadata: {
            durationMinutes,
            source: 'manual',
            ...(dto.notes ? { notes: notePreview(dto.notes) } : {}),
          },
        },
        tx,
      );

      return created;
    });
  }

  /** Starts a running timer — assignee only, one running timer per user at a time. */
  async startTimer(
    workspaceId: string,
    projectId: string,
    workItemId: string,
    userId: string,
  ) {
    const workItem = await this.assertWorkItem(
      workspaceId,
      projectId,
      workItemId,
    );
    this.assertAssignee(workItem, userId);

    const running = await this.prisma.timeLog.findFirst({
      where: { userId, endTime: null, source: TimeLogSource.timer },
    });
    if (running) {
      throw new ConflictException(
        'A timer is already running. Stop it before starting another.',
      );
    }

    const now = new Date();
    return this.prisma.timeLog.create({
      data: {
        workspaceId,
        projectId,
        workItemId,
        userId,
        date: now,
        startTime: now,
        endTime: null,
        durationMinutes: 0,
        billingType: TimeLogBillingType.billable,
        source: 'timer',
      },
      include: TIME_LOG_INCLUDE,
    });
  }

  /** Stops the caller's running timer on this work item. */
  async stopTimer(
    workspaceId: string,
    projectId: string,
    workItemId: string,
    userId: string,
    notes?: string,
  ) {
    const workItem = await this.assertWorkItem(
      workspaceId,
      projectId,
      workItemId,
    );

    const running = await this.prisma.timeLog.findFirst({
      where: { workItemId, userId, endTime: null, source: 'timer' },
    });
    if (!running) {
      throw new NotFoundException('No running timer for this work item.');
    }

    const endTime = new Date();
    const durationMinutes = Math.max(
      1,
      Math.round((endTime.getTime() - running.startTime.getTime()) / 60000),
    );
    const finalNotes = notes ?? running.notes;
    const entityType = await this.resolveEntityType(
      workspaceId,
      workItem.workItemTypeId,
    );

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.timeLog.update({
        where: { id: running.id },
        data: { endTime, durationMinutes, notes: finalNotes },
        include: TIME_LOG_INCLUDE,
      });

      await this.activityLog.log(
        {
          workspaceId,
          projectId,
          entityType,
          entityId: workItemId,
          action: 'time_logged',
          userId,
          metadata: {
            durationMinutes,
            source: 'timer',
            ...(finalNotes ? { notes: notePreview(finalNotes) } : {}),
          },
        },
        tx,
      );

      return updated;
    });
  }

  /** Every entry in the project, newest first, for the project-level Time Logs tab. */
  async listForProject(
    workspaceId: string,
    projectId: string,
    filters: ListTimeLogsDto,
  ) {
    await this.assertProject(workspaceId, projectId);
    return this.prisma.timeLog.findMany({
      where: this.buildProjectFilter(projectId, filters),
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        ...TIME_LOG_INCLUDE,
        workItem: { select: { id: true, name: true, prefix: true } },
      },
    });
  }

  async exportCsv(
    workspaceId: string,
    projectId: string,
    filters: ListTimeLogsDto,
  ): Promise<string> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
      select: { name: true, workspace: { select: { name: true } } },
    });
    if (!project) throw new NotFoundException('Project not found');

    const entries = await this.listForProject(workspaceId, projectId, filters);

    const userNames = [
      ...new Map(
        entries.map((entry) => [entry.user.id, displayName(entry.user)]),
      ).values(),
    ];
    const totalMinutes = entries.reduce(
      (sum, entry) => sum + entry.durationMinutes,
      0,
    );

    const rows = entries.map((entry) => [
      entry.date.toISOString().slice(0, 10),
      displayName(entry.user),
      entry.workItem.prefix
        ? `${entry.workItem.prefix} - ${entry.workItem.name}`
        : entry.workItem.name,
      minutesToHours(entry.durationMinutes),
      formatCsvDateTime(entry.startTime),
      formatCsvDateTime(entry.endTime),
      entry.billingType,
      entry.notes ?? '',
    ]);

    return toCsv(rows, [
      ['Workspace', project.workspace.name],
      ['Project', project.name],
      ['User', userNames.join(', ')],
      ['Total hours logged', minutesToHours(totalMinutes)],
    ]);
  }

  /** Edits an entry — only the entry's own logger may edit it. */
  async update(id: string, userId: string, dto: UpdateTimeLogDto) {
    const entry = await this.getOwned(id, userId);

    if (dto.date !== undefined) {
      const preferences = await this.getPreferences(entry.workspaceId);
      this.assertLogDateAllowed(preferences, dto.date);
    }

    let startTime = entry.startTime;
    let endTime = entry.endTime;
    let durationMinutes = entry.durationMinutes;

    if (dto.startTime !== undefined || dto.endTime !== undefined) {
      const nextStart =
        dto.startTime !== undefined ? new Date(dto.startTime) : startTime;
      const nextEnd =
        dto.endTime !== undefined ? new Date(dto.endTime) : endTime;
      if (!nextStart || !nextEnd) {
        throw new BadRequestException(
          'startTime and endTime must be provided together',
        );
      }
      if (nextEnd <= nextStart) {
        throw new BadRequestException('endTime must be after startTime');
      }
      startTime = nextStart;
      endTime = nextEnd;
      durationMinutes = Math.max(
        1,
        Math.round((nextEnd.getTime() - nextStart.getTime()) / 60000),
      );
    } else if (dto.durationMinutes !== undefined) {
      if (dto.durationMinutes < 1) {
        throw new BadRequestException('durationMinutes must be at least 1');
      }
      durationMinutes = dto.durationMinutes;
    }

    return this.prisma.timeLog.update({
      where: { id },
      data: {
        date: dto.date ? new Date(dto.date) : undefined,
        startTime,
        endTime,
        durationMinutes,
        billingType: dto.billingType ?? undefined,
        notes: dto.notes ?? undefined,
      },
      include: TIME_LOG_INCLUDE,
    });
  }

  /** Deletes an entry — only the entry's own logger may delete it. */
  async remove(id: string, userId: string) {
    await this.getOwned(id, userId);
    await this.prisma.timeLog.delete({ where: { id } });
    return { id, deleted: true };
  }

  // --- helpers ---

  private async getPreferences(workspaceId: string) {
    const row = await this.prisma.workspacePreference.findUnique({
      where: { workspaceId },
    });
    return resolveTimeLogPreferences(row);
  }

  /** Enforces the workspace's past-date restriction on a log entry's date. */
  private assertLogDateAllowed(
    preferences: ReturnType<typeof resolveTimeLogPreferences>,
    dateStr: string,
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const logDate = new Date(dateStr);
    logDate.setHours(0, 0, 0, 0);

    if (logDate >= today) return;

    if (!preferences.allowPastTimeLog) {
      throw new ForbiddenException(
        'Logging time for past dates is disabled for this workspace.',
      );
    }

    if (preferences.pastTimeLogLimitValue) {
      const cutoff = subtractUnit(
        today,
        preferences.pastTimeLogLimitValue,
        preferences.pastTimeLogLimitUnit,
      );
      if (logDate < cutoff) {
        const unit = preferences.pastTimeLogLimitUnit;
        throw new BadRequestException(
          `You can only log time up to ${preferences.pastTimeLogLimitValue} ${unit}${preferences.pastTimeLogLimitValue > 1 ? 's' : ''} in the past.`,
        );
      }
    }
  }

  private assertAssignee(
    workItem: { assigneeId: string | null },
    userId: string,
  ) {
    if (workItem.assigneeId !== userId) {
      throw new ForbiddenException(
        'Only the assignee can log time on this work item.',
      );
    }
  }

  private async assertWorkItem(
    workspaceId: string,
    projectId: string,
    workItemId: string,
  ) {
    const workItem = await this.prisma.workItem.findFirst({
      where: { id: workItemId, projectId, project: { workspaceId } },
      select: { id: true, assigneeId: true, workItemTypeId: true },
    });
    if (!workItem) throw new NotFoundException('Work item not found');
    return workItem;
  }

  /** The work item's WorkType category ('task', 'incident', ...), for the activity log's entityType. */
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

  private async assertProject(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }

  private async getOwned(id: string, userId: string) {
    const entry = await this.prisma.timeLog.findFirst({
      where: { id, userId },
    });
    if (!entry) throw new NotFoundException('Time log entry not found');
    return entry;
  }

  private buildProjectFilter(
    projectId: string,
    filters: ListTimeLogsDto,
  ): Prisma.TimeLogWhereInput {
    return {
      projectId,
      ...EXCLUDE_RUNNING_TIMER,
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.startDate || filters.endDate
        ? {
            date: {
              ...(filters.startDate
                ? { gte: new Date(filters.startDate) }
                : {}),
              ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
            },
          }
        : {}),
    };
  }

  /** Resolves a manual entry's period: an explicit start+end pair, or a bare duration. */
  private resolvePeriod(dto: CreateTimeLogDto): {
    startTime: Date | null;
    endTime: Date | null;
    durationMinutes: number;
  } {
    const hasStart = dto.startTime !== undefined;
    const hasEnd = dto.endTime !== undefined;
    if (hasStart !== hasEnd) {
      throw new BadRequestException(
        'startTime and endTime must be provided together',
      );
    }

    if (hasStart && hasEnd) {
      const startTime = new Date(dto.startTime);
      const endTime = new Date(dto.endTime);
      if (endTime <= startTime) {
        throw new BadRequestException('endTime must be after startTime');
      }
      return {
        startTime,
        endTime,
        durationMinutes: Math.max(
          1,
          Math.round((endTime.getTime() - startTime.getTime()) / 60000),
        ),
      };
    }

    if (!dto.durationMinutes || dto.durationMinutes < 1) {
      throw new BadRequestException(
        'durationMinutes must be at least 1 when no start/end time is given',
      );
    }
    return {
      startTime: null,
      endTime: null,
      durationMinutes: dto.durationMinutes,
    };
  }
}
