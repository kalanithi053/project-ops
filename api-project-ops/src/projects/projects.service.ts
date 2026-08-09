import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AttachmentsService,
  extractAttachmentIds,
} from '../attachments/attachments.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { POSITION_GAP } from '../common/constants/workspace-defaults';

/** Shared select for the Sales Rep / Project Manager relations. */
const PROJECT_PERSON_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
} as const;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attachments: AttachmentsService,
  ) {}

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

    // Validate the chosen Hubs (all must belong to the workspace + this
    // project type) and that every selected plan's Hub (if it has one) is
    // among them — keeps the Hub multi-select and Plan multi-select
    // referentially consistent.
    const hubIds = dto.hubId ?? [];
    const selectedHubs = hubIds.length
      ? await this.prisma.hub.findMany({
          where: {
            id: { in: hubIds },
            workspaceId,
            projectTypeId: projectType.id,
          },
        })
      : [];
    if (selectedHubs.length !== hubIds.length) {
      throw new BadRequestException('One or more hubs not found in workspace');
    }
    const planMissingHub = selectedPlans.find(
      (plan) => plan.hubId && !hubIds.includes(plan.hubId),
    );
    if (planMissingHub) {
      throw new BadRequestException(
        'Every selected plan’s Hub must be included in the selected Hubs',
      );
    }

    this.assertEstimation(dto);
    await this.assertWorkspaceMember(workspaceId, dto.salesRepId, 'Sales rep');
    await this.assertWorkspaceMember(
      workspaceId,
      dto.projectManagerId,
      'Project manager',
    );

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
          hubId: hubIds,
          description: dto.description,
          startDate,
          endDate,
          ownerId: userId,
          salesRepId: dto.salesRepId,
          projectManagerId: dto.projectManagerId,
          engagementType: dto.engagementType,
          estimatedHours: dto.estimatedHours,
          estimatedDate: dto.estimatedDate
            ? new Date(dto.estimatedDate)
            : undefined,
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
          projectType: {
            select: { id: true, name: true, isPlanAdd: true, color: true },
          },
          salesRep: { select: PROJECT_PERSON_SELECT },
          projectManager: { select: PROJECT_PERSON_SELECT },
          moduleInstances: { include: { module: true } },
          members: true,
        },
      });
    });
  }

  /** Enforces the estimation format matching `engagementType`, see schema.prisma's Project comment. */
  private assertEstimation(dto: CreateProjectDto) {
    if (dto.engagementType === 'time_and_material') {
      if (dto.estimatedDate) {
        throw new BadRequestException(
          'estimatedDate is not valid for a time_and_material engagement — use estimatedHours',
        );
      }
    } else if (
      dto.engagementType === 'fixed_budget' ||
      dto.engagementType === 'retainer'
    ) {
      if (dto.estimatedHours !== undefined) {
        throw new BadRequestException(
          `estimatedHours is not valid for a ${dto.engagementType} engagement — use estimatedDate`,
        );
      }
    } else if (dto.estimatedHours !== undefined || dto.estimatedDate) {
      throw new BadRequestException(
        'engagementType is required to set an estimation',
      );
    }
  }

  /** Confirms an optional user id is an active member of the workspace. */
  private async assertWorkspaceMember(
    workspaceId: string,
    userId: string | undefined,
    label: string,
  ) {
    if (!userId) return;
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId, status: 'active' },
    });
    if (!member) {
      throw new BadRequestException(
        `${label} must be an active member of the workspace`,
      );
    }
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
    const defaultPriority = await tx.priority.findFirst({
      where: { workspaceId, isDefault: true },
    });
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

    // Spaced from the start (not a dense 0, 1, 2, ...) so the Kanban board
    // can insert between any two of these seed rows without needing to
    // rebalance the whole column the first time one of them is dragged —
    // see task-board.tsx's handleDragEnd.
    let seedPosition = 0;

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
            priorityId: defaultPriority?.id,
            position: seedPosition,
          },
        });
        seedPosition += POSITION_GAP;

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
        projectType: {
          select: { id: true, name: true, isPlanAdd: true, color: true },
        },
        salesRep: { select: PROJECT_PERSON_SELECT },
        projectManager: { select: PROJECT_PERSON_SELECT },
        _count: { select: { members: true } },
      },
    });
  }

  async findOne(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
      include: {
        projectType: {
          select: { id: true, name: true, isPlanAdd: true, color: true },
        },
        salesRep: { select: PROJECT_PERSON_SELECT },
        projectManager: { select: PROJECT_PERSON_SELECT },
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
    const existing = await this.assertProject(workspaceId, projectId);
    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        name: dto.name ?? undefined,
        description: dto.description ?? undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });

    // An image the user removed from the description (kept in the DB row
    // and S3 as an inline attachment) is otherwise orphaned forever — clean
    // up whatever attachment ids dropped out between the old and new text.
    if (dto.description !== undefined) {
      const oldIds = extractAttachmentIds(existing.description);
      const newIds = extractAttachmentIds(dto.description);
      const droppedIds = Array.from(oldIds).filter((id) => !newIds.has(id));
      if (droppedIds.length > 0) {
        await this.attachments.deleteByIds(workspaceId, droppedIds);
      }
    }

    return updated;
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
