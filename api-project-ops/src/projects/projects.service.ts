import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PlanLimitException } from '../common/exceptions/plan-limit.exception';
import { PlansService } from '../plans/plans.service';
import { PrismaService } from '../prisma/prisma.service';
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
    // The chosen project type decides whether plan-based steps run.
    const projectType = await this.prisma.projectType.findFirst({
      where: { id: dto.projectTypeId, workspaceId },
    });
    const isExistingProject = await this.prisma.project.findMany({
      where: { name: dto.name, workspaceId },
    });
    if (isExistingProject.length) {
      throw new BadRequestException('Project name already exists');
    }
    if (!projectType) {
      throw new BadRequestException('Project type not found in workspace');
    }

    const plan = await this.plans.getPlan(workspaceId, dto?.planId);
    // When the type provisions a plan, enforce the chosen plan's project quota.
    if (projectType.isPlanAdd) {
      if (!plan) {
        throw new BadRequestException(
          'Plan is required for this type of project',
        );
      }
      const projectCount = await this.prisma.project.count({
        where: { workspaceId, deletedAt: null },
      });
      if (projectCount >= plan.maxProjects) {
        throw new PlanLimitException(
          `Project limit reached (${plan.maxProjects}). Upgrade your plan to add more.`,
        );
      }
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          workspaceId,
          name: dto.name,
          projectTypeId: projectType.id,
          planId: plan?.id,
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

      // isPlanAdd types auto-provision the chosen plan's default modules + seed
      // tasks; otherwise the project starts empty.
      if (projectType.isPlanAdd) {
        await this.provisionDefaultModules(tx, {
          project,
          workspaceId,
          planId: plan.id,
          userId,
          startDate,
          endDate,
        });
      }

      return tx.project.findUnique({
        where: { id: project.id },
        include: {
          projectType: { select: { id: true, name: true, isPlanAdd: true } },
          plan: { select: { id: true, name: true } },
          moduleInstances: { include: { module: true } },
          tasks: true,
          members: true,
        },
      });
    });
  }

  /**
   * Attaches the active plan's default modules to a project and seeds one task
   * each. Which modules get attached depends on the workspace's active plan.
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

    for (const module of defaultModules) {
      const instance = await tx.moduleInstance.create({
        data: {
          projectId: project.id,
          moduleId: module.id,
          taskLimit: module.defaultTaskLimit,
        },
      });
      Array.from({ length: module.defaultTaskLimit ?? 1 }).forEach(
        async (_, index) => {
          await tx.task.create({
            data: {
              projectId: project.id,
              moduleInstanceId: instance.id,
              prefix: `${module.name} - ${index + 1}`,
              name: module.name,
              startDate,
              dueDate: endDate,
              statusId: defaultStatus?.id ?? null,
              createdBy: userId,
              position: 0,
            },
          });
        },
      );
    }
  }

  list(workspaceId: string) {
    return this.prisma.project.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        projectType: { select: { id: true, name: true, isPlanAdd: true } },
        _count: { select: { tasks: true, members: true } },
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
          include: { user: { select: { id: true, username: true } } },
        },
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
