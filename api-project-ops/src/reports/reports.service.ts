import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type ReportWorkItem = {
  moduleInstanceId: string;
  assigneeId: string | null;
  workItemType: {
    id: string;
    name: string;
    category: string;
    color: string | null;
  } | null;
  status: { name: string; category: string; isDefault: boolean } | null;
  priority: { name: string } | null;
  estimateHours: number | null;
  completedHours: number | null;
};

const PROGRESS_STAGES: Array<{ max: number; stage: string }> = [
  { max: 0, stage: 'Not Started' },
  { max: 39, stage: 'Early Stage' },
  { max: 79, stage: 'In Progress' },
  { max: 99, stage: 'Near Completion' },
  { max: 100, stage: 'Completed' },
];

const UNCATEGORIZED = 'Uncategorized';

function displayName(user: {
  email: string;
  firstName: string | null;
  lastName: string | null;
}): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return name || user.email.split('@')[0];
}

/**
 * Reports are computed live from WorkItem rows — every breakdown groups by
 * whatever WorkTypes (task/incident/bug/...) the workspace actually has
 * configured, rather than assuming a fixed set of categories.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProjectReport(workspaceId: string, projectId: string) {
    await this.assertProject(workspaceId, projectId);

    const [instances, items, members, ticketStatuses] = await Promise.all([
      this.prisma.moduleInstance.findMany({
        where: { projectId },
        include: { module: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.workItem.findMany({
        where: {
          projectId,
          NOT: { status: { is: { category: 'removed' } } },
        },
        select: {
          moduleInstanceId: true,
          assigneeId: true,
          workItemType: {
            select: { id: true, name: true, category: true, color: true },
          },
          status: { select: { name: true, category: true, isDefault: true } },
          priority: { select: { name: true } },
          estimateHours: true,
          completedHours: true,
        },
      }),
      this.prisma.projectMember.findMany({
        where: { projectId, status: { not: 'removed' } },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.ticketStatus.findMany({
        where: { workspaceId, NOT: { category: 'removed' } },
        select: { name: true, color: true, order: true },
        orderBy: { order: 'asc' },
      }),
    ]);

    return {
      modules: this.buildModuleUsage(instances, items),
      statusBreakdown: this.buildStatusBreakdown(ticketStatuses, items),
      byPriority: this.buildPriorityMatrix(items),
      byType: this.buildTypeBreakdown(items),
      progress: this.buildProgress(items),
      user: this.buildUserWorkload(members, items),
    };
  }

  /** Every live work item in a workspace, grouped by its WorkType and status. */
  async getWorkspaceReport(workspaceId: string) {
    const items = await this.prisma.workItem.findMany({
      where: {
        project: { workspaceId, deletedAt: null },
        NOT: { status: { is: { category: 'removed' } } },
      },
      select: {
        workItemType: { select: { name: true, category: true } },
        status: { select: { name: true } },
      },
    });

    const byType = new Map<string, number>();
    const byStatus = new Map<string, number>();
    for (const item of items) {
      const typeName = item.workItemType?.name ?? UNCATEGORIZED;
      const statusName = item.status?.name ?? 'No status';
      byType.set(typeName, (byType.get(typeName) ?? 0) + 1);
      const label = `${typeName} · ${statusName}`;
      byStatus.set(label, (byStatus.get(label) ?? 0) + 1);
    }

    return {
      totalItems: items.length,
      byType: [...byType.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      statusBreakdown: [...byStatus.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort(
          (left, right) =>
            right.count - left.count || left.label.localeCompare(right.label),
        ),
    };
  }

  /** Per module instance: how many work items are past "New", against its limit/addon. */
  private buildModuleUsage(
    instances: Array<{
      id: string;
      taskLimit: number;
      addonTask: number;
      module: { name: string };
    }>,
    items: ReportWorkItem[],
  ) {
    return instances.map((instance) => {
      const moduleItems = items.filter(
        (i) => i.moduleInstanceId === instance.id,
      );
      const used = moduleItems.filter((i) => !i.status?.isDefault).length;
      return {
        id: instance.id,
        module: instance.module.name,
        used,
        limit: instance.taskLimit,
        addon: instance.addonTask,
      };
    });
  }

  /** Includes every configured workflow status, even when a project has no work there. */
  private buildStatusBreakdown(
    statuses: Array<{ name: string; color: string | null; order: number }>,
    items: ReportWorkItem[],
  ) {
    const counts = new Map<string, number>();
    for (const item of items) {
      const name = item.status?.name;
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return statuses.map((status) => ({
      name: status.name,
      color: status.color,
      count: counts.get(status.name) ?? 0,
    }));
  }

  private buildPriorityMatrix(items: ReportWorkItem[]) {
    const byPriority = new Map<string, Map<string, number>>();
    for (const item of items) {
      const priorityName = item.priority?.name ?? 'Unassigned';
      const statusName = item.status?.name ?? 'Unassigned';
      if (!byPriority.has(priorityName)) {
        byPriority.set(priorityName, new Map());
      }
      const statuses = byPriority.get(priorityName);
      statuses.set(statusName, (statuses.get(statusName) ?? 0) + 1);
    }
    return [...byPriority.entries()].map(([priority, statuses]) => ({
      priority,
      statuses: Object.fromEntries(statuses),
    }));
  }

  /** Dynamic breakdown by WorkType — one entry per category/name actually in use. */
  private buildTypeBreakdown(items: ReportWorkItem[]) {
    const byType = new Map<
      string,
      {
        name: string;
        category: string;
        color: string | null;
        total: number;
        done: number;
      }
    >();
    for (const item of items) {
      const key = item.workItemType?.id ?? 'uncategorized';
      if (!byType.has(key)) {
        byType.set(key, {
          name: item.workItemType?.name ?? UNCATEGORIZED,
          category: item.workItemType?.category ?? 'uncategorized',
          color: item.workItemType?.color ?? null,
          total: 0,
          done: 0,
        });
      }
      const entry = byType.get(key);
      entry.total += 1;
      if (item.status?.category === 'done') entry.done += 1;
    }
    return [...byType.values()].sort((a, b) => b.total - a.total);
  }

  private buildProgress(items: ReportWorkItem[]) {
    const total = items.length;
    const done = items.filter((i) => i.status?.category === 'done').length;
    const percentComplete = total === 0 ? 0 : Math.round((done / total) * 100);
    const stage =
      PROGRESS_STAGES.find((s) => percentComplete <= s.max)?.stage ??
      'Completed';

    return { totalItems: total, doneItems: done, percentComplete, stage };
  }

  /** Per project member: their assigned work item load, completion, and hours,
   * with a dynamic per-WorkType breakdown. */
  private buildUserWorkload(
    members: Array<{
      userId: string;
      user: {
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
      };
    }>,
    items: ReportWorkItem[],
  ) {
    return members.map((member) => {
      const mine = items.filter((i) => i.assigneeId === member.userId);
      const completedItems = mine.filter(
        (i) => i.status?.category === 'done',
      ).length;
      const totalEstimateHours = mine.reduce(
        (sum, i) => sum + (i.estimateHours ?? 0),
        0,
      );
      const totalCompletedHours = mine.reduce(
        (sum, i) => sum + (i.completedHours ?? 0),
        0,
      );

      const byType = new Map<string, number>();
      for (const item of mine) {
        const name = item.workItemType?.name ?? UNCATEGORIZED;
        byType.set(name, (byType.get(name) ?? 0) + 1);
      }

      return {
        name: displayName(member.user),
        totalItems: mine.length,
        completedItems,
        totalEstimateHours,
        totalCompletedHours,
        byType: Object.fromEntries(byType),
      };
    });
  }

  private async assertProject(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }
}
