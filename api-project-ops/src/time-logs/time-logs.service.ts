import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TimeLogBillingType, TimeLogSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  resolveTimeLogPreferences,
  subtractUnit,
} from '../common/constants/time-log-preferences';
import { CreateTimeLogDto } from './dto/create-time-log.dto';
import { UpdateTimeLogDto } from './dto/update-time-log.dto';
import { ListTimeLogsDto } from './dto/list-time-logs.dto';

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
  'Duration (min)',
  'Start',
  'End',
  'Billing',
  'Notes',
] as const;

/** Minimal CSV writer — quotes/escapes only the handful of characters that matter. */
function toCsv(rows: string[][]): string {
  const escape = (value: string) =>
    /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  return [Array.from(CSV_COLUMNS), ...rows]
    .map((row) => row.map(escape).join(','))
    .join('\r\n');
}

@Injectable()
export class TimeLogsService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.timeLog.create({
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
    await this.assertWorkItem(workspaceId, projectId, workItemId);

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

    return this.prisma.timeLog.update({
      where: { id: running.id },
      data: { endTime, durationMinutes, notes: notes ?? running.notes },
      include: TIME_LOG_INCLUDE,
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
    const entries = await this.listForProject(workspaceId, projectId, filters);
    const rows = entries.map((entry) => [
      entry.date.toISOString().slice(0, 10),
      entry.user.email,
      entry.workItem.prefix
        ? `${entry.workItem.prefix} - ${entry.workItem.name}`
        : entry.workItem.name,
      String(entry.durationMinutes),
      entry.startTime?.toISOString() ?? '',
      entry.endTime?.toISOString() ?? '',
      entry.billingType,
      entry.notes ?? '',
    ]);
    return toCsv(rows);
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
      select: { id: true, assigneeId: true },
    });
    if (!workItem) throw new NotFoundException('Work item not found');
    return workItem;
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
