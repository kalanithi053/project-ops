import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';
import { PlanLimitException } from '../common/exceptions/plan-limit.exception';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
  ) {}

  /**
   * Creates a project and, atomically:
   *   1. enforces the plan's maxProjects quota,
   *   2. attaches every default (isDefault) workspace module as a ModuleInstance,
   *   3. seeds one Task per instance ("{Module Name} - 1"),
   *   4. adds the creator as an active Owner ProjectMember.
   */
  async create(workspaceId: string, userId: string, dto: CreateProjectDto) {
    const plan = await this.plans.getActivePlan(workspaceId);
    const projectCount = await this.prisma.project.count({
      where: { workspaceId, deletedAt: null },
    });
    if (projectCount >= plan.maxProjects) {
      throw new PlanLimitException(
        `Project limit reached (${plan.maxProjects}). Upgrade your plan to add more.`,
      );
    }

    const startDate = dto.startDate ? new Date(dto.startDate) : null;
    const endDate = dto.endDate ? new Date(dto.endDate) : null;

    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          workspaceId,
          name: dto.name,
          mode: dto.mode,
          description: dto.description,
          startDate,
          endDate,
          ownerId: userId,
        },
      });

      // Owner role for the creator's ProjectMember record.
      const ownerRole =
        (await tx.userRole.findFirst({
          where: { workspaceId, name: 'Owner' },
        })) ??
        (await tx.userRole.findFirst({
          where: { workspaceId, isDefault: true },
        }));

      if (ownerRole) {
        await tx.projectMember.create({
          data: {
            projectId: project.id,
            userId,
            roleId: ownerRole.id,
            status: 'active',
            invitedBy: userId,
          },
        });
      }

      // Only HubSpot projects auto-provision default modules + seed tasks.
      // Dev projects start empty.
      if (project.mode === 'HubSpot') {
        await this.provisionDefaultModules(tx, {
          project,
          workspaceId,
          userId,
          startDate,
          endDate,
        });
      }

      return tx.project.findUnique({
        where: { id: project.id },
        include: {
          moduleInstances: { include: { module: true } },
          tasks: true,
          members: true,
        },
      });
    });
  }

  /** Attaches the workspace's default modules to a project and seeds one task each. */
  private async provisionDefaultModules(
    tx: Prisma.TransactionClient,
    ctx: {
      project: { id: string };
      workspaceId: string;
      userId: string;
      startDate: Date | null;
      endDate: Date | null;
    },
  ) {
    const { project, workspaceId, userId, startDate, endDate } = ctx;

    // Default workspace ticket status for seed tasks.
    const defaultStatus =
      (await tx.ticketStatus.findFirst({
        where: { workspaceId, isDefault: true },
      })) ??
      (await tx.ticketStatus.findFirst({
        where: { workspaceId },
        orderBy: { order: 'asc' },
      }));

    const defaultModules = await tx.module.findMany({
      where: { workspaceId, isDefault: true, isActive: true },
    });

    for (const module of defaultModules) {
      const instance = await tx.moduleInstance.create({
        data: {
          projectId: project.id,
          moduleId: module.id,
          taskLimit: module.defaultTaskLimit,
        },
      });

      await tx.task.create({
        data: {
          projectId: project.id,
          moduleInstanceId: instance.id,
          name: `${module.name} - 1`,
          startDate,
          dueDate: endDate,
          statusId: defaultStatus?.id ?? null,
          createdBy: userId,
          position: 0,
        },
      });
    }
  }

  list(workspaceId: string) {
    return this.prisma.project.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { tasks: true, members: true } } },
    });
  }

  async findOne(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
      include: {
        moduleInstances: { include: { module: true } },
        members: { include: { user: { select: { id: true, username: true } } } },
        _count: { select: { tasks: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(workspaceId: string, projectId: string, dto: UpdateProjectDto) {
    await this.assertProject(workspaceId, projectId);
    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        name: dto.name ?? undefined,
        description: dto.description ?? undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async remove(workspaceId: string, projectId: string) {
    await this.assertProject(workspaceId, projectId);
    await this.prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() },
    });
    return { id: projectId, deleted: true };
  }

  private async assertProject(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }
}
