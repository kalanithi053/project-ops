import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    workspaceId: string,
    projectId: string,
    filters: { moduleInstanceId?: string; statusId?: string; priorityId?: string },
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
        assignee: { select: { id: true, username: true } },
      },
    });
  }

  async create(
    workspaceId: string,
    projectId: string,
    userId: string,
    dto: CreateTaskDto,
  ) {
    await this.assertProject(workspaceId, projectId);

    if (dto.moduleInstanceId) {
      await this.assertInstanceCapacity(projectId, dto.moduleInstanceId);
    }
    if (dto.statusId) await this.assertStatus(workspaceId, dto.statusId);
    if (dto.priorityId) await this.assertPriority(workspaceId, dto.priorityId);
    if (dto.assigneeId) await this.assertAssignee(workspaceId, dto.assigneeId);

    const position = dto.position ?? (await this.nextPosition(projectId));

    return this.prisma.task.create({
      data: {
        projectId,
        moduleInstanceId: dto.moduleInstanceId ?? null,
        name: dto.name,
        prefix: dto.prefix ?? null,
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
  }

  async findOne(workspaceId: string, projectId: string, taskId: string) {
    const task = await this.getTask(workspaceId, projectId, taskId);
    return task;
  }

  async update(
    workspaceId: string,
    projectId: string,
    taskId: string,
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

    return this.prisma.task.update({
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
    });
  }

  async remove(workspaceId: string, projectId: string, taskId: string) {
    await this.getTask(workspaceId, projectId, taskId);
    await this.prisma.task.update({
      where: { id: taskId },
      data: { deletedAt: new Date() },
    });
    return { id: taskId, deleted: true };
  }

  // --- helpers ---

  private async assertProject(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  /** Enforces ModuleInstance.taskLimit before adding a task to that instance. */
  private async assertInstanceCapacity(
    projectId: string,
    moduleInstanceId: string,
  ) {
    const instance = await this.prisma.moduleInstance.findFirst({
      where: { id: moduleInstanceId, projectId },
    });
    if (!instance) {
      throw new BadRequestException('Module instance not found in project');
    }
    const count = await this.prisma.task.count({
      where: { moduleInstanceId, deletedAt: null },
    });
    if (count >= instance.taskLimit) {
      throw new ConflictException(
        `Module task limit reached (${instance.taskLimit}).`,
      );
    }
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
        assignee: { select: { id: true, username: true } },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }
}
