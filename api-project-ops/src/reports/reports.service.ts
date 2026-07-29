import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type ReportTask = {
  moduleInstanceId: string | null;
  assigneeId: string | null;
  status: { name: string; category: string; isDefault: boolean } | null;
  priority: { name: string } | null;
  estimateHours: number | null;
  completedHours: number | null;
};

type ReportIncident = {
  assigneeId: string | null;
  status: { name: string; category: string; isDefault: boolean } | null;
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

function displayName(user: {
  email: string;
  firstName: string | null;
  lastName: string | null;
}): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return name || user.email;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProjectReport(workspaceId: string, projectId: string) {
    await this.assertProject(workspaceId, projectId);

    const [instances, tasks, incidents, members, ticketStatuses] = await Promise.all([
      this.prisma.moduleInstance.findMany({
        where: { projectId },
        include: { module: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.task.findMany({
        where: { projectId, deletedAt: null },
        select: {
          moduleInstanceId: true,
          assigneeId: true,
          status: { select: { name: true, category: true, isDefault: true } },
          priority: { select: { name: true } },
          estimateHours: true,
          completedHours: true,
        },
      }),
      this.prisma.incident.findMany({
        where: { projectId },
        select: {
          assigneeId: true,
          status: { select: { name: true, category: true, isDefault: true } },
          estimateHours: true,
          completedHours: true,
        },
      }),
      this.prisma.projectMember.findMany({
        where: { projectId, status: { not: 'removed' } },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.ticketStatus.findMany({
        where: { workspaceId },
        select: { name: true, color: true, order: true },
        orderBy: { order: 'asc' },
      }),
    ]);

    return {
      modules: this.buildModuleUsage(instances, tasks),
      statusBreakdown: this.buildStatusBreakdown(ticketStatuses, tasks),
      byPriority: this.buildPriorityMatrix(tasks),
      progress: this.buildProgress(tasks),
      user: this.buildUserWorkload(members, tasks, incidents),
    };
  }

  /** Every live task and incident in a workspace, grouped by its current status. */
  async getWorkspaceReport(workspaceId: string) {
    const [tasks, incidents] = await Promise.all([
      this.prisma.task.findMany({
        where: { deletedAt: null, project: { workspaceId, deletedAt: null } },
        select: { status: { select: { name: true, category: true } } },
      }),
      this.prisma.incident.findMany({
        where: { workspaceId, project: { deletedAt: null } },
        select: { status: { select: { name: true, category: true } } },
      }),
    ]);

    const byStatus = new Map<string, number>();
    for (const task of tasks) {
      const status = task.status?.name ?? 'No status';
      const label = `Task · ${status}`;
      byStatus.set(label, (byStatus.get(label) ?? 0) + 1);
    }
    for (const incident of incidents) {
      const label = `Incident · ${incident.status?.name ?? 'No status'}`;
      byStatus.set(label, (byStatus.get(label) ?? 0) + 1);
    }

    return {
      totalTasks: tasks.length,
      totalIncidents: incidents.length,
      statusBreakdown: [...byStatus.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)),
    };
  }

  /** Per module instance: how many tasks are past "New", against its limit/addon. */
  private buildModuleUsage(
    instances: Array<{
      id: string;
      taskLimit: number;
      addonTask: number;
      module: { name: string };
    }>,
    tasks: ReportTask[],
  ) {
    return instances.map((instance) => {
      const moduleTasks = tasks.filter(
        (t) => t.moduleInstanceId === instance.id,
      );
      const used = moduleTasks.filter((t) => !t.status?.isDefault).length;
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
    tasks: ReportTask[],
  ) {
    const counts = new Map<string, number>();
    for (const task of tasks) {
      const name = task.status?.name;
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return statuses.map((status) => ({
      name: status.name,
      color: status.color,
      count: counts.get(status.name) ?? 0,
    }));
  }

  private buildPriorityMatrix(tasks: ReportTask[]) {
    const byPriority = new Map<string, Map<string, number>>();
    for (const task of tasks) {
      const priorityName = task.priority?.name ?? 'Unassigned';
      const statusName = task.status?.name ?? 'Unassigned';
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

  private buildProgress(tasks: ReportTask[]) {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status?.category === 'done').length;
    const percentComplete = total === 0 ? 0 : Math.round((done / total) * 100);
    const stage =
      PROGRESS_STAGES.find((s) => percentComplete <= s.max)?.stage ??
      'Completed';

    return { totalTasks: total, doneTasks: done, percentComplete, stage };
  }

  /** Per project member: their assigned task/incident load, completion, and hours. */
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
    tasks: ReportTask[],
    incidents: ReportIncident[],
  ) {
    return members.map((member) => {
      const myTasks = tasks.filter((t) => t.assigneeId === member.userId);
      const myIncidents = incidents.filter(
        (i) => i.assigneeId === member.userId,
      );

      const completedTasks = myTasks.filter(
        (t) => t.status?.category === 'done',
      ).length;
      const completedIncidents = myIncidents.filter(
        (i) => i.status?.category === 'done',
      ).length;

      const totalEstimateHours = this.sumHours(
        myTasks,
        myIncidents,
        'estimateHours',
      );
      const totalCompletedHours = this.sumHours(
        myTasks,
        myIncidents,
        'completedHours',
      );

      return {
        name: displayName(member.user),
        totalTasks: myTasks.length,
        totalIncidents: myIncidents.length,
        completedTasks,
        completedIncidents,
        totalEstimateHours,
        totalCompletedHours,
      };
    });
  }

  private sumHours(
    tasks: ReportTask[],
    incidents: ReportIncident[],
    field: 'estimateHours' | 'completedHours',
  ): number {
    const taskSum = tasks.reduce((sum, t) => sum + (t[field] ?? 0), 0);
    const incidentSum = incidents.reduce((sum, i) => sum + (i[field] ?? 0), 0);
    return taskSum + incidentSum;
  }

  private async assertProject(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }
}
