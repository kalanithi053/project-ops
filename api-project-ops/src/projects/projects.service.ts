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
   *   2. seeds tasks per instance ("{Module Name} - N"),
   *   3. adds the creator as an active Owner ProjectMember.
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

      // isPlanAdd types auto-provision each chosen plan's default modules +
      // seed tasks; otherwise the project starts empty.
      if (projectType.isPlanAdd) {
        // `position` runs continuously across plans so the seeded board has a
        // stable, distinct ordering instead of every task sitting at 0.
        let position = 0;
        // Two plans can each contribute a module of the same name, so prefixes
        // are numbered per module *name* across the whole project — matching
        // how TasksService numbers tasks added later.
        const prefixCounts = new Map<string, number>();
        // Collected across every plan and written in one statement: a plan set
        // can seed ~90 tasks, and that many round-trips would push the
        // interactive transaction toward its timeout.
        const taskRows: Prisma.TaskCreateManyInput[] = [];

        for (const plan of selectedPlans) {
          position = await this.provisionDefaultModules(tx, {
            project,
            workspaceId,
            planId: plan.id,
            userId,
            startDate,
            endDate,
            startPosition: position,
            prefixCounts,
            taskRows,
          });
        }

        if (taskRows.length) {
          await tx.task.createMany({ data: taskRows });
        }
      }

      return tx.project.findUnique({
        where: { id: project.id },
        include: {
          projectType: { select: { id: true, name: true, isPlanAdd: true } },
          moduleInstances: { include: { module: true } },
          tasks: true,
          members: true,
        },
      });
      // Above Prisma's 5s default: provisioning several plans means a module
      // instance per module plus a bulk insert of every seeded task.
    }, { timeout: 20_000 });
  }

  /**
   * Attaches a plan's default modules to a project and seeds one task per
   * unit of each module's quantity, stamped with the workspace's default
   * status and priority.
   *
   * `defaultTaskLimit` is the quantity the plan entitles the project to, so a
   * module with 10 seeds "Workflows - 1" through "Workflows - 10". That fills
   * the instance to its allowance by design — the 11th task is then counted
   * as an add-on via `ModuleInstance.addonTask`, which is exactly what that
   * counter is for.
   *
   * Rows are pushed onto `taskRows` rather than inserted here so the caller
   * can write them all in one createMany.
   *
   * Returns the next free `position` so numbering stays continuous when a
   * project is created under several plans.
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
      startPosition: number;
      /** Module name -> tasks seeded so far, shared across plans. */
      prefixCounts: Map<string, number>;
      /** Accumulator the caller flushes with a single createMany. */
      taskRows: Prisma.TaskCreateManyInput[];
    },
  ): Promise<number> {
    const {
      project,
      workspaceId,
      planId,
      userId,
      startDate,
      endDate,
      startPosition,
      prefixCounts,
      taskRows,
    } = ctx;

    // Default workspace ticket status and priority for seed tasks, so a new
    // board opens with every card already sitting in a real column.
    const defaultStatus =
      (await tx.ticketStatus.findFirst({
        where: { workspaceId, isDefault: true },
      })) ??
      (await tx.ticketStatus.findFirst({
        where: { workspaceId },
        orderBy: { order: 'asc' },
      }));

    const defaultPriority =
      (await tx.priority.findFirst({
        where: { workspaceId, isDefault: true },
      })) ??
      (await tx.priority.findFirst({
        where: { workspaceId },
        orderBy: { order: 'asc' },
      }));

    // Only this plan's default modules.
    const defaultModules = await tx.module.findMany({
      where: { workspaceId, planId, isDefault: true, isActive: true },
      orderBy: { name: 'asc' },
    });

    let position = startPosition;

    for (const module of defaultModules) {
      const instance = await tx.moduleInstance.create({
        data: {
          projectId: project.id,
          moduleId: module.id,
          taskLimit: module.defaultTaskLimit,
        },
      });

      const quantity = Math.max(0, module.defaultTaskLimit);
      let seededSoFar = prefixCounts.get(module.name) ?? 0;

      for (let unit = 0; unit < quantity; unit += 1) {
        seededSoFar += 1;
        taskRows.push({
          projectId: project.id,
          moduleInstanceId: instance.id,
          // The stable key, mirroring how TasksService numbers later tasks.
          prefix: `${module.name} - ${seededSoFar}`,
          // Numbered too, so ten cards don't all read "Workflows" on the
          // board. Users rename these afterwards.
          name: `${module.name} ${seededSoFar}`,
          startDate,
          dueDate: endDate,
          statusId: defaultStatus?.id ?? null,
          priorityId: defaultPriority?.id ?? null,
          createdBy: userId,
          position,
        });
        position += 1;
      }

      prefixCounts.set(module.name, seededSoFar);
    }

    return position;
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
