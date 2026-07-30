import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a project and, atomically:
   *   1. attaches each chosen plan's default modules as ModuleInstances,
   *   2. adds the creator as an active Owner ProjectMember.
   */
  async create(workspaceId: string, userId: string, dto: CreateProjectDto) {
    // The chosen project type decides whether plan-based steps run.
    const projectType = await this.prisma.projectType.findFirst({
      where: { id: dto.projectTypeId, workspaceId },
    });
    const isExistingProject = await this.prisma.project.findMany({
      where: { name: dto.name, workspaceId, deletedAt: null },
    });
    if (isExistingProject.length) {
      throw new BadRequestException('Project name already exists');
    }
    if (!projectType) {
      throw new BadRequestException('Project type not found in workspace');
    }

    // Validate the chosen plans (all must belong to the workspace).
    const planIds = dto.planId ?? [];
    const selectedPlans = planIds.length
      ? await this.prisma.plan.findMany({
          where: { id: { in: planIds }, workspaceId },
        })
      : [];
    if (selectedPlans.length !== planIds.length) {
      throw new BadRequestException('One or more plans not found in workspace');
    }

    // When the type provisions plans, at least one is required.
    if (projectType.isPlanAdd && !selectedPlans.length) {
      throw new BadRequestException(
        'At least one plan is required for this type of project',
      );
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    this.assertFutureDate(startDate, 'startDate');
    this.assertFutureDate(endDate, 'endDate');
    if (endDate < startDate) {
      throw new BadRequestException('endDate cannot be before startDate');
    }

    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          workspaceId,
          name: dto.name,
          projectTypeId: projectType.id,
          planId: planIds,
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

      // isPlanAdd types auto-provision each chosen plan's default modules;
      // otherwise the project starts empty.
      if (projectType.isPlanAdd) {
        for (const plan of selectedPlans) {
          await this.provisionDefaultModules(tx, {
            project,
            workspaceId,
            planId: plan.id,
            userId,
            startDate,
            endDate,
          });
        }
      }

      return tx.project.findUnique({
        where: { id: project.id },
        include: {
          projectType: { select: { id: true, name: true, isPlanAdd: true } },
          moduleInstances: { include: { module: true } },
          members: true,
        },
      });
    });
  }

  /**
   * Attaches the active plan's default modules to a project as
   * ModuleInstances. Which modules get attached depends on the workspace's
   * active plan.
   */
  private async provisionDefaultModules(
    tx: Prisma.TransactionClient,
    ctx: {
      project: { id: string };
      workspaceId: string;
      planId: string;
      userId: string;
      startDate: Date | null;
      endDate: Date | null;
    },
  ) {
    const { project, workspaceId, planId, userId, startDate, endDate } = ctx;

    // Default workspace ticket status for seed tasks.
    const defaultStatus =
      (await tx.ticketStatus.findFirst({
        where: { workspaceId, isDefault: true },
      })) ??
      (await tx.ticketStatus.findFirst({
        where: { workspaceId },
        orderBy: { order: 'asc' },
      }));

    // Only the active plan's default modules.
    const defaultModules = await tx.module.findMany({
      where: { workspaceId, planId, isDefault: true, isActive: true },
    });
    const workType = await tx.workType.findFirst({
      where: { workspaceId, category: 'task' },
    });
    const entityType = workType?.category ?? 'task';

    for (const module of defaultModules) {
      const instance = await tx.moduleInstance.create({
        data: {
          projectId: project.id,
          moduleId: module.id,
          taskLimit: module.defaultTaskLimit,
        },
      });
      for (let index = 0; index < (module.defaultTaskLimit ?? 1); index += 1) {
        const workItem = await tx.workItem.create({
          data: {
            projectId: project.id,
            moduleInstanceId: instance.id,
            workItemTypeId: workType?.id ?? null,
            prefix: `${module.name}-${index + 1}`,
            name: module.name,
            startDate,
            dueDate: endDate,
            statusId: defaultStatus?.id ?? null,
            createdBy: userId,
            assigneeId: userId,
          },
        });

        await tx.activityLog.create({
          data: {
            workspaceId,
            projectId: project.id,
            entityType,
            entityId: workItem.id,
            action: 'created',
            userId,
            metadata: {
              name: workItem.name,
              statusId: workItem.statusId,
              assigneeId: workItem.assigneeId,
            },
          },
        });
      }
    }
  }

  list(workspaceId: string) {
    return this.prisma.project.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        projectType: { select: { id: true, name: true, isPlanAdd: true } },
        _count: { select: { members: true } },
      },
    });
  }

  async findOne(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
      include: {
        projectType: { select: { id: true, name: true, isPlanAdd: true } },
        moduleInstances: { include: { module: true } },
        members: {
          include: { user: { select: { id: true, email: true } } },
        },
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

  /** Rejects dates before today (UTC), while allowing a project to start today. */
  private assertFutureDate(date: Date, field: string) {
    const now = new Date();
    const todayUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    if (date.getTime() < todayUtc.getTime()) {
      throw new BadRequestException(`${field} must be today or later`);
    }
  }
}
