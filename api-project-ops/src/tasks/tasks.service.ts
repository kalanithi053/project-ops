import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const TASK_UPDATE_FIELDS = [
  'name',
  'prefix',
  'description',
  'moduleInstanceId',
  'startDate',
  'dueDate',
  'statusId',
  'priorityId',
  'assigneeId',
  'position',
] as const;

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async list(
    workspaceId: string,
    projectId: string,
    filters: {
      moduleInstanceId?: string;
      statusId?: string;
      priorityId?: string;
    },
  ) {
    await this.assertProject(workspaceId, projectId);
    return this.prisma.task.findMany({
      where: {
        projectId,
        deletedAt: null,
        moduleInstanceId: filters.moduleInstanceId ?? undefined,
        statusId: filters.statusId ?? undefined,
        priorityId: filters.priorityId ?? undefined,
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: {
        status: { select: { id: true, name: true, category: true } },
        priority: { select: { id: true, name: true, color: true } },
        assignee: { select: { id: true, email: true } },
      },
    });
  }

  async create(
    workspaceId: string,
    projectId: string,
    userId: string,
    dto: CreateTaskDto,
  ) {
    const project = await this.assertProject(workspaceId, projectId);

    // Auto-generate the prefix (an explicit dto.prefix always wins):
    //  - module-bound task:   "{Module Name} - N" where N continues the sequence
    //    (equals taskLimit + addonTask once the instance is over its limit)
    //  - unbound task:        "{first letter of project}T{task count + 1}"
    let prefix = dto.prefix ?? null;
    const projectType = await this.prisma.projectType.findFirst({
      where: { workspaceId, id: project.projectTypeId },
    });
    if (projectType?.isPlanAdd && !dto.moduleInstanceId) {
      throw new BadRequestException(
        'Module instance is required for this project',
      );
    }
    // The instance the task will actually be stored under (may differ from the
    // requested one when overflow spills into a same-named module instance).
    let resolvedInstanceId = dto.moduleInstanceId ?? null;

    if (dto.moduleInstanceId) {
      const { instance, groupCount } = await this.resolveInstanceForTask(
        projectId,
        dto.moduleInstanceId,
      );
      resolvedInstanceId = instance.id;
      prefix = prefix ?? `${instance.module.name} - ${groupCount + 1}`;
    } else if (!prefix) {
      const taskCount = await this.prisma.task.count({
        where: { projectId, deletedAt: null },
      });
      prefix = `${project.name.charAt(0).toUpperCase()}-T${taskCount + 1}`;
    }

    if (dto.statusId) await this.assertStatus(workspaceId, dto.statusId);
    if (dto.priorityId) await this.assertPriority(workspaceId, dto.priorityId);
    if (dto.assigneeId) await this.assertAssignee(workspaceId, dto.assigneeId);

    const position = dto.position ?? (await this.nextPosition(projectId));

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          projectId,
          moduleInstanceId: resolvedInstanceId,
          name: dto.name,
          prefix,
          description: dto.description,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          statusId: dto.statusId ?? null,
          priorityId: dto.priorityId ?? null,
          assigneeId: dto.assigneeId ?? null,
          createdBy: userId,
          position,
        },
      });

      await this.activityLog.log(
        {
          workspaceId,
          projectId,
          entityType: 'task',
          entityId: task.id,
          action: 'created',
          userId,
          metadata: {
            name: task.name,
            statusId: task.statusId,
            assigneeId: task.assigneeId,
          },
        },
        tx,
      );

      return task;
    });
  }

  async findOne(workspaceId: string, projectId: string, taskId: string) {
    const task = await this.getTask(workspaceId, projectId, taskId);
    return task;
  }

  async update(
    workspaceId: string,
    projectId: string,
    taskId: string,
    userId: string,
    dto: UpdateTaskDto,
  ) {
    const task = await this.getTask(workspaceId, projectId, taskId);

    // Moving into a (different) module instance re-checks capacity.
    if (
      dto.moduleInstanceId &&
      dto.moduleInstanceId !== task.moduleInstanceId
    ) {
      await this.assertInstanceCapacity(projectId, dto.moduleInstanceId);
    }
    if (dto.statusId) await this.assertStatus(workspaceId, dto.statusId);
    if (dto.priorityId) await this.assertPriority(workspaceId, dto.priorityId);
    if (dto.assigneeId) await this.assertAssignee(workspaceId, dto.assigneeId);

    const statusChanged = !!dto.statusId && dto.statusId !== task.statusId;
    const changes = this.computeTaskChanges(task, dto);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.task.update({
        where: { id: taskId },
        data: {
          name: dto.name ?? undefined,
          prefix: dto.prefix ?? undefined,
          description: dto.description ?? undefined,
          moduleInstanceId: dto.moduleInstanceId ?? undefined,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          statusId: dto.statusId ?? undefined,
          priorityId: dto.priorityId ?? undefined,
          assigneeId: dto.assigneeId ?? undefined,
          position: dto.position ?? undefined,
        },
        include: {
          status: { select: { id: true, name: true, category: true } },
          priority: { select: { id: true, name: true, color: true } },
          assignee: { select: { id: true, email: true } },
          creator: { select: { id: true, email: true } },
        },
      });

      if (Object.keys(changes).length > 0) {
        await this.activityLog.log(
          {
            workspaceId,
            projectId,
            entityType: 'task',
            entityId: taskId,
            action: 'updated',
            userId,
            metadata: { changes },
          },
          tx,
        );
      }

      return result;
    });

    if (statusChanged) {
      await this.notifyStatusChange(
        updated,
        task.status?.name ?? 'None',
        updated.status?.name ?? 'None',
      );
    }

    return updated;
  }

  /**
   * Status-only update, guarded by the narrow `task.status.update` permission
   * (e.g. the Client role). Touches nothing but statusId.
   */
  async updateStatus(
    workspaceId: string,
    projectId: string,
    taskId: string,
    userId: string,
    statusId: string,
  ) {
    const task = await this.getTask(workspaceId, projectId, taskId);
    await this.assertStatus(workspaceId, statusId);
    const statusChanged = statusId !== task.statusId;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.task.update({
        where: { id: taskId },
        data: { statusId },
        include: {
          status: { select: { id: true, name: true, category: true } },
          priority: { select: { id: true, name: true, color: true } },
          assignee: { select: { id: true, email: true } },
          creator: { select: { id: true, email: true } },
        },
      });

      if (statusChanged) {
        await this.activityLog.log(
          {
            workspaceId,
            projectId,
            entityType: 'task',
            entityId: taskId,
            action: 'status_changed',
            userId,
            metadata: { from: task.statusId, to: statusId },
          },
          tx,
        );
      }

      return result;
    });

    if (statusChanged) {
      await this.notifyStatusChange(
        updated,
        task.status?.name ?? 'None',
        updated.status?.name ?? 'None',
      );
    }

    return updated;
  }

  async remove(
    workspaceId: string,
    projectId: string,
    taskId: string,
    userId: string,
  ) {
    await this.getTask(workspaceId, projectId, taskId);
    await this.prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: taskId },
        data: { deletedAt: new Date() },
      });
      await this.activityLog.log(
        {
          workspaceId,
          projectId,
          entityType: 'task',
          entityId: taskId,
          action: 'deleted',
          userId,
        },
        tx,
      );
    });
    return { id: taskId, deleted: true };
  }

  /** Activity log entries for one task, newest first. */
  async getActivity(workspaceId: string, projectId: string, taskId: string) {
    await this.getTask(workspaceId, projectId, taskId);
    return this.activityLog.getTimeline(workspaceId, taskId, 'task');
  }

  /** On-demand nudge — emails the assignee with the task's current status. */
  async notifyAssignee(workspaceId: string, projectId: string, taskId: string) {
    const task = await this.getTask(workspaceId, projectId, taskId);
    if (!task.assignee) {
      throw new BadRequestException('Task has no assignee to notify');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: task.projectId },
      select: { name: true },
    });

    await this.mail.sendStatusNotificationEmail(task.assignee.email, {
      entityLabel: 'task',
      entityName: task.prefix ? `${task.prefix} · ${task.name}` : task.name,
      projectName: project?.name ?? 'Unknown project',
      statusName: task.status?.name ?? 'None',
    });

    return { notified: true, assignee: task.assignee.email };
  }

  // --- helpers ---

  private async assertProject(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  /**
   * Checks ModuleInstance.taskLimit before adding a task to that instance.
   * Tasks beyond the limit are not rejected — instead the instance's
   * `addonTask` counter is incremented to track the overage. Returns the
   * instance (with its module) and the current task count for prefix numbering.
   */
  private async assertInstanceCapacity(
    projectId: string,
    moduleInstanceId: string,
  ) {
    const instance = await this.prisma.moduleInstance.findFirst({
      where: { id: moduleInstanceId, projectId },
      include: { module: { select: { name: true } } },
    });
    if (!instance) {
      throw new BadRequestException('Module instance not found in project');
    }
    const count = await this.prisma.task.count({
      where: { moduleInstanceId, deletedAt: null },
    });
    if (count >= instance.taskLimit) {
      await this.prisma.moduleInstance.update({
        where: { id: instance.id },
        data: { addonTask: { increment: 1 } },
      });
    }
    return { instance, count };
  }

  /**
   * Picks the module instance a new task should land on. A project can hold
   * multiple plans whose modules share a name (different module ids), so:
   *  1. load the requested instance,
   *  2. gather every instance in the project whose module has the same NAME,
   *  3. if the requested instance is full, use the first same-named instance
   *     that still has capacity,
   *  4. if every same-named instance is full, keep the requested instance and
   *     increment its addonTask counter.
   * Returns the chosen instance and the task count across the whole name group
   * (used for continuous "Module - N" prefix numbering).
   */
  private async resolveInstanceForTask(
    projectId: string,
    moduleInstanceId: string,
  ) {
    const requested = await this.prisma.moduleInstance.findFirst({
      where: { id: moduleInstanceId, projectId },
      include: { module: { select: { name: true } } },
    });
    if (!requested) {
      throw new BadRequestException('Module instance not found in project');
    }

    // All same-named instances in this project, requested one first.
    const sameName = await this.prisma.moduleInstance.findMany({
      where: { projectId, module: { name: requested.module.name } },
      include: { module: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const ordered = [
      requested,
      ...sameName.filter((i) => i.id !== requested.id),
    ];

    const counts = new Map<string, number>();
    for (const inst of ordered) {
      counts.set(
        inst.id,
        await this.prisma.task.count({
          where: { moduleInstanceId: inst.id, deletedAt: null },
        }),
      );
    }
    const groupCount = [...counts.values()].reduce((a, b) => a + b, 0);

    // First same-named instance with spare capacity (requested gets priority).
    const withCapacity = ordered.find(
      (inst) => (counts.get(inst.id) ?? 0) < inst.taskLimit,
    );
    if (withCapacity) {
      return { instance: withCapacity, groupCount };
    }

    // Everything full -> overage stays on the requested instance.
    await this.prisma.moduleInstance.update({
      where: { id: requested.id },
      data: { addonTask: { increment: 1 } },
    });
    return { instance: requested, groupCount };
  }

  private async assertStatus(workspaceId: string, statusId: string) {
    const status = await this.prisma.ticketStatus.findFirst({
      where: { id: statusId, workspaceId },
    });
    if (!status) throw new BadRequestException('Status not found in workspace');
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

  private async nextPosition(projectId: string): Promise<number> {
    const last = await this.prisma.task.findFirst({
      where: { projectId, deletedAt: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  /** Diffs a patch against the current task, field by field, for the audit log. */
  private computeTaskChanges(
    task: Record<string, unknown>,
    dto: UpdateTaskDto,
  ): Record<string, { from: unknown; to: unknown }> {
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const field of TASK_UPDATE_FIELDS) {
      const patchValue = dto[field];
      if (patchValue === undefined) continue;

      const isDateField = field === 'startDate' || field === 'dueDate';
      const before = isDateField
        ? ((task[field] as Date | null)?.toISOString() ?? null)
        : task[field];
      const after = isDateField
        ? new Date(patchValue).toISOString()
        : patchValue;

      if (before !== after) {
        changes[field] = { from: before, to: after };
      }
    }
    return changes;
  }

  private async getTask(
    workspaceId: string,
    projectId: string,
    taskId: string,
  ) {
    await this.assertProject(workspaceId, projectId);
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId, deletedAt: null },
      include: {
        status: { select: { id: true, name: true, category: true } },
        priority: { select: { id: true, name: true, color: true } },
        assignee: { select: { id: true, email: true } },
        creator: { select: { id: true, email: true } },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  /**
   * Notifies the task's creator and assignee (deduped, skipping unset
   * assignee) that its status changed. Best-effort — a mail failure never
   * fails the status update itself.
   */
  private async notifyStatusChange(
    task: {
      name: string;
      prefix: string | null;
      projectId: string;
      creator: { id: string; email: string };
      assignee: { id: string; email: string } | null;
    },
    oldStatusName: string,
    newStatusName: string,
  ): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: task.projectId },
      select: { name: true },
    });

    const recipients = new Map<string, string>([
      [task.creator.id, task.creator.email],
    ]);
    if (task.assignee) recipients.set(task.assignee.id, task.assignee.email);
    await Promise.all(
      [...recipients.values()].map((email) =>
        this.mail
          .sendTaskStatusChangedEmail(email, {
            taskName: task.name,
            taskPrefix: task.prefix,
            projectName: project?.name ?? 'Unknown project',
            oldStatusName,
            newStatusName,
          })
          .catch((err) =>
            this.logger.error(
              `Failed to send task status email to=${email}: ${(err as Error).message}`,
            ),
          ),
      ),
    );
  }
}
