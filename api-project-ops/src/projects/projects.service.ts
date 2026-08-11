import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AttachmentsService,
  extractAttachmentIds,
} from '../attachments/attachments.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, ModuleSelectionDto } from './dto/create-project.dto';
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

      // isPlanAdd types provision modules for the project. The New Project
      // form sends an explicit `moduleSelections` list (pre-populated from
      // each plan's defaults, editable before submit); older/other callers
      // that omit it get the legacy behavior — every isDefault module,
      // at its catalog task limit.
      if (projectType.isPlanAdd) {
        if (dto.moduleSelections?.length) {
          await this.provisionSelectedModules(tx, {
            project,
            workspaceId,
            userId,
            startDate,
            endDate,
            selections: dto.moduleSelections,
            selectedPlanIds: new Set(selectedPlans.map((plan) => plan.id)),
          });
        } else {
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
  private assertEstimation(
    dto: Pick<
      CreateProjectDto,
      'engagementType' | 'estimatedHours' | 'estimatedDate'
    >,
  ) {
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

  /**
   * Attaches the New Project form's explicit module choices instead of a
   * plan's isDefault set — existing catalog modules and/or brand-new ones,
   * each with its own per-project task count. New modules are created
   * under their chosen plan with isDefault: false, so this stays a
   * per-project override rather than changing what future projects on that
   * plan get by default.
   */
  private async provisionSelectedModules(
    tx: Prisma.TransactionClient,
    ctx: {
      project: { id: string };
      workspaceId: string;
      userId: string;
      startDate: Date | null;
      endDate: Date | null;
      selections: ModuleSelectionDto[];
      selectedPlanIds: Set<string>;
    },
  ) {
    const {
      project,
      workspaceId,
      userId,
      startDate,
      endDate,
      selections,
      selectedPlanIds,
    } = ctx;

    const seedContext = await this.loadSeedContext(tx, workspaceId);
    const positionRef = { current: 0 };

    for (const selection of selections) {
      const module = selection.moduleId
        ? await this.getModuleForSelection(
            tx,
            workspaceId,
            selection.moduleId,
            selectedPlanIds,
          )
        : await this.createModuleForSelection(
            tx,
            workspaceId,
            selection,
            selectedPlanIds,
          );

      await this.createSeededModuleInstance(tx, {
        project,
        workspaceId,
        userId,
        startDate,
        endDate,
        module,
        taskLimit: Math.max(0, selection.taskLimit),
        ...seedContext,
        positionRef,
      });
    }
  }

  /** Shared lookups for seeding a module instance's starter tasks. */
  private async loadSeedContext(
    tx: Prisma.TransactionClient,
    workspaceId: string,
  ) {
    const defaultPriority = await tx.priority.findFirst({
      where: { workspaceId, isDefault: true },
    });
    const defaultStatus =
      (await tx.ticketStatus.findFirst({
        where: { workspaceId, isDefault: true },
      })) ??
      (await tx.ticketStatus.findFirst({
        where: { workspaceId },
        orderBy: { order: 'asc' },
      }));
    const workType = await tx.workType.findFirst({
      where: { workspaceId, category: 'task' },
    });
    return { defaultPriority, defaultStatus, workType };
  }

  /**
   * Creates one ModuleInstance and seeds it with `taskLimit` starter tasks —
   * the same seeding create() has always done, extracted so an edit that
   * attaches a brand-new module gets the identical starter tasks a newly
   * created project would.
   */
  private async createSeededModuleInstance(
    tx: Prisma.TransactionClient,
    ctx: {
      project: { id: string };
      workspaceId: string;
      userId: string;
      startDate: Date | null;
      endDate: Date | null;
      module: { id: string; name: string };
      taskLimit: number;
      defaultPriority: { id: string } | null;
      defaultStatus: { id: string } | null;
      workType: { id: string; category: string } | null;
      positionRef: { current: number };
    },
  ) {
    const {
      project,
      workspaceId,
      userId,
      startDate,
      endDate,
      module,
      taskLimit,
      defaultPriority,
      defaultStatus,
      workType,
      positionRef,
    } = ctx;
    const entityType = workType?.category ?? 'task';

    const instance = await tx.moduleInstance.create({
      data: { projectId: project.id, moduleId: module.id, taskLimit },
    });

    for (let index = 0; index < taskLimit; index += 1) {
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
          position: positionRef.current,
        },
      });
      positionRef.current += POSITION_GAP;

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

    return instance;
  }

  /**
   * Reconciles an existing project's module instances against a fresh
   * desired selection (used by update() when the owner edits plans/hubs/
   * modules, or switches project type). A module kept from before just gets
   * its taskLimit adjusted; a newly attached module is seeded exactly like
   * create() seeds one; a module no longer desired is detached — its
   * ModuleInstance is deleted, and WorkItem.moduleInstanceId is set null by
   * the FK (see schema.prisma), so existing tasks survive, just unfiled.
   */
  private async reconcileModuleInstances(
    tx: Prisma.TransactionClient,
    ctx: {
      project: { id: string };
      workspaceId: string;
      userId: string;
      startDate: Date | null;
      endDate: Date | null;
      existingInstances: Array<{
        id: string;
        moduleId: string;
        taskLimit: number;
      }>;
      isPlanAdd: boolean;
      planIds: string[];
      selections?: ModuleSelectionDto[];
    },
  ) {
    const {
      project,
      workspaceId,
      userId,
      startDate,
      endDate,
      existingInstances,
      isPlanAdd,
      planIds,
      selections,
    } = ctx;

    // Explicit selections win; otherwise fall back to each plan's isDefault
    // modules at their catalog task limit — same fallback create() uses.
    // Not plan-add (or no plans left) means every existing instance gets
    // detached below.
    let desired: ModuleSelectionDto[] = [];
    if (isPlanAdd && planIds.length) {
      if (selections?.length) {
        desired = selections;
      } else {
        const defaultModules = await tx.module.findMany({
          where: {
            workspaceId,
            planId: { in: planIds },
            isDefault: true,
            isActive: true,
          },
        });
        desired = defaultModules.map((module) => ({
          moduleId: module.id,
          taskLimit: module.defaultTaskLimit,
        }));
      }
    }

    const selectedPlanIds = new Set(planIds);
    const existingByModuleId = new Map(
      existingInstances.map((instance) => [instance.moduleId, instance]),
    );
    const keepModuleIds = new Set<string>();
    const seedContext = await this.loadSeedContext(tx, workspaceId);
    const positionRef = { current: 0 };

    for (const selection of desired) {
      const module = selection.moduleId
        ? await this.getModuleForSelection(
            tx,
            workspaceId,
            selection.moduleId,
            selectedPlanIds,
          )
        : await this.createModuleForSelection(
            tx,
            workspaceId,
            selection,
            selectedPlanIds,
          );
      keepModuleIds.add(module.id);

      const taskLimit = Math.max(0, selection.taskLimit);
      const existingInstance = existingByModuleId.get(module.id);
      if (existingInstance) {
        if (existingInstance.taskLimit !== taskLimit) {
          await tx.moduleInstance.update({
            where: { id: existingInstance.id },
            data: { taskLimit },
          });
        }
        continue;
      }

      await this.createSeededModuleInstance(tx, {
        project,
        workspaceId,
        userId,
        startDate,
        endDate,
        module,
        taskLimit,
        ...seedContext,
        positionRef,
      });
    }

    const toRemove = existingInstances.filter(
      (instance) => !keepModuleIds.has(instance.moduleId),
    );
    if (toRemove.length) {
      await tx.moduleInstance.deleteMany({
        where: { id: { in: toRemove.map((instance) => instance.id) } },
      });
    }
  }

  private async getModuleForSelection(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    moduleId: string,
    selectedPlanIds: Set<string>,
  ) {
    const module = await tx.module.findFirst({
      where: { id: moduleId, workspaceId },
    });
    if (!module) {
      throw new BadRequestException(
        `Module ${moduleId} not found in workspace`,
      );
    }
    if (!selectedPlanIds.has(module.planId)) {
      throw new BadRequestException(
        'Module does not belong to one of the selected plans',
      );
    }
    return module;
  }

  private async createModuleForSelection(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    selection: ModuleSelectionDto,
    selectedPlanIds: Set<string>,
  ) {
    if (!selection.planId || !selection.name) {
      throw new BadRequestException(
        'New module selections require planId and name',
      );
    }
    if (!selectedPlanIds.has(selection.planId)) {
      throw new BadRequestException(
        'A new module’s planId must be one of the selected plans',
      );
    }
    const key = this.slugifyModuleKey(selection.name);
    const existing = await tx.module.findFirst({
      where: { planId: selection.planId, key },
    });
    if (existing) {
      throw new ConflictException(
        `A module named "${selection.name}" already exists on this plan — pick it from the list instead.`,
      );
    }
    return tx.module.create({
      data: {
        workspaceId,
        planId: selection.planId,
        key,
        name: selection.name,
        defaultTaskLimit: selection.taskLimit,
        isDefault: false,
        isActive: true,
      },
    });
  }

  /** Derives a stable machine key from a free-typed module name. */
  private slugifyModuleKey(name: string): string {
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return slug || 'module';
  }

  list(workspaceId: string, userId: string) {
    return this.prisma.project.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        members: { some: { userId, status: { not: 'removed' } } },
      },
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

  /**
   * Per-project schedule/budget health for the Owner/Admin/Client dashboard:
   * hours utilized against whichever basis the engagement actually has —
   * an hours budget for time_and_material, or a date window (start →
   * estimatedDate, falling back to endDate) for fixed_budget/retainer — plus
   * the work-item completion split. One computation backs both the
   * dashboard's "hours utilized" card and its per-project meter box, since
   * they're the same numbers presented two ways.
   */
  async getUtilization(workspaceId: string) {
    const projects = await this.prisma.project.findMany({
      where: { workspaceId, deletedAt: null },
      select: {
        id: true,
        name: true,
        engagementType: true,
        startDate: true,
        endDate: true,
        estimatedDate: true,
        estimatedHours: true,
      },
    });
    if (!projects.length) return [];

    const projectIds = projects.map((p) => p.id);
    const [loggedTotals, workItems] = await Promise.all([
      this.prisma.timeLog.groupBy({
        by: ['projectId'],
        where: {
          projectId: { in: projectIds },
          NOT: { source: 'timer', endTime: null },
        },
        _sum: { durationMinutes: true },
      }),
      this.prisma.workItem.findMany({
        where: {
          projectId: { in: projectIds },
          NOT: { status: { is: { category: 'removed' } } },
        },
        select: { projectId: true, status: { select: { category: true } } },
      }),
    ]);

    const loggedMinutesByProject = new Map(
      loggedTotals.map((row) => [row.projectId, row._sum.durationMinutes ?? 0]),
    );
    const statsByProject = new Map<string, { total: number; done: number }>();
    for (const item of workItems) {
      const stats = statsByProject.get(item.projectId) ?? {
        total: 0,
        done: 0,
      };
      stats.total += 1;
      if (item.status?.category === 'done') stats.done += 1;
      statsByProject.set(item.projectId, stats);
    }

    const now = new Date();
    return projects.map((project) => {
      const loggedHours = (loggedMinutesByProject.get(project.id) ?? 0) / 60;
      const stats = statsByProject.get(project.id) ?? { total: 0, done: 0 };
      const statusPercentComplete =
        stats.total === 0 ? 0 : Math.round((stats.done / stats.total) * 100);

      const isHoursBasis =
        project.engagementType === 'time_and_material' &&
        Boolean(project.estimatedHours);
      const targetDate = project.estimatedDate ?? project.endDate;
      const isDateBasis =
        !isHoursBasis && Boolean(project.startDate && targetDate);

      let estimatedHours: number | null = null;
      let remainingHours: number | null = null;
      let percentOfHoursUsed: number | null = null;
      if (isHoursBasis) {
        estimatedHours = project.estimatedHours;
        remainingHours = Math.round((estimatedHours - loggedHours) * 10) / 10;
        percentOfHoursUsed = Math.round((loggedHours / estimatedHours) * 100);
      }

      let percentTimeElapsed: number | null = null;
      let daysRemaining: number | null = null;
      if (isDateBasis) {
        const start = project.startDate.getTime();
        const target = targetDate.getTime();
        const span = target - start;
        percentTimeElapsed =
          span <= 0
            ? 100
            : Math.max(
                0,
                Math.min(
                  100,
                  Math.round(((now.getTime() - start) / span) * 100),
                ),
              );
        daysRemaining = Math.round(
          (target - now.getTime()) / (1000 * 60 * 60 * 24),
        );
      }

      return {
        id: project.id,
        name: project.name,
        engagementType: project.engagementType,
        loggedHours: Math.round(loggedHours * 10) / 10,
        basis: isHoursBasis
          ? ('hours' as const)
          : isDateBasis
            ? ('date' as const)
            : ('none' as const),
        estimatedHours,
        remainingHours,
        percentOfHoursUsed,
        startDate: project.startDate,
        targetDate,
        percentTimeElapsed,
        daysRemaining,
        statusPercentComplete,
        totalWorkItems: stats.total,
        doneWorkItems: stats.done,
      };
    });
  }

  async update(
    workspaceId: string,
    projectId: string,
    dto: UpdateProjectDto,
    userId: string,
  ) {
    const existing = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
      include: { moduleInstances: true },
    });
    if (!existing) throw new NotFoundException('Project not found');

    const startDate = dto.startDate
      ? new Date(dto.startDate)
      : existing.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : existing.endDate;
    if (endDate < startDate) {
      throw new BadRequestException('endDate cannot be before startDate');
    }

    if (dto.salesRepId !== undefined) {
      await this.assertWorkspaceMember(
        workspaceId,
        dto.salesRepId ?? undefined,
        'Sales rep',
      );
    }
    if (dto.projectManagerId !== undefined) {
      await this.assertWorkspaceMember(
        workspaceId,
        dto.projectManagerId ?? undefined,
        'Project manager',
      );
    }

    // Merge with the existing record so a partial edit (e.g. just
    // estimatedHours) is validated against whichever engagementType ends
    // up in effect, not against a field the caller didn't touch.
    const engagementType =
      dto.engagementType !== undefined
        ? (dto.engagementType ?? undefined)
        : (existing.engagementType ?? undefined);
    const estimatedHours =
      dto.estimatedHours !== undefined
        ? (dto.estimatedHours ?? undefined)
        : (existing.estimatedHours ?? undefined);
    const estimatedDate =
      dto.estimatedDate !== undefined
        ? (dto.estimatedDate ?? undefined)
        : (existing.estimatedDate?.toISOString() ?? undefined);
    this.assertEstimation({ engagementType, estimatedHours, estimatedDate });

    // Resolve whichever project type is in effect after this edit (the new
    // one if changing, else the current one) — its isPlanAdd flag decides
    // whether plans/hubs/modules apply at all.
    const targetProjectTypeId = dto.projectTypeId ?? existing.projectTypeId;
    let projectType: { id: string; isPlanAdd: boolean } | null = null;
    if (targetProjectTypeId) {
      projectType = await this.prisma.projectType.findFirst({
        where: { id: targetProjectTypeId, workspaceId },
      });
      if (dto.projectTypeId !== undefined && !projectType) {
        throw new BadRequestException('Project type not found in workspace');
      }
    }
    const isPlanAdd = projectType?.isPlanAdd ?? false;
    const isChangingType =
      dto.projectTypeId !== undefined &&
      dto.projectTypeId !== existing.projectTypeId;

    // Plans/Hubs/Modules are only re-validated and reconciled when the
    // caller actually touches one of them, or the type just changed —
    // switching type invalidates whatever plans/hubs the project had under
    // its old type, so those get cleared unless the caller sends fresh ones
    // in the same request.
    const touchesProvisioning =
      dto.planId !== undefined ||
      dto.hubId !== undefined ||
      dto.moduleSelections !== undefined ||
      isChangingType;

    const planIds = touchesProvisioning
      ? (dto.planId ?? (isChangingType ? [] : existing.planId))
      : existing.planId;
    const hubIds = touchesProvisioning
      ? (dto.hubId ?? (isChangingType ? [] : existing.hubId))
      : existing.hubId;
    let selectedPlans: { id: string; hubId: string | null }[] = [];

    if (touchesProvisioning) {
      selectedPlans = planIds.length
        ? await this.prisma.plan.findMany({
            where: { id: { in: planIds }, workspaceId },
          })
        : [];
      if (selectedPlans.length !== planIds.length) {
        throw new BadRequestException(
          'One or more plans not found in workspace',
        );
      }
      if (isPlanAdd && !selectedPlans.length) {
        throw new BadRequestException(
          'At least one plan is required for this type of project',
        );
      }

      const selectedHubs = hubIds.length
        ? await this.prisma.hub.findMany({
            where: {
              id: { in: hubIds },
              workspaceId,
              projectTypeId: projectType?.id,
            },
          })
        : [];
      if (selectedHubs.length !== hubIds.length) {
        throw new BadRequestException(
          'One or more hubs not found in workspace',
        );
      }
      const planMissingHub = selectedPlans.find(
        (plan) => plan.hubId && !hubIds.includes(plan.hubId),
      );
      if (planMissingHub) {
        throw new BadRequestException(
          'Every selected plan’s Hub must be included in the selected Hubs',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id: projectId },
        data: {
          name: dto.name ?? undefined,
          description: dto.description ?? undefined,
          startDate: dto.startDate ? startDate : undefined,
          endDate: dto.endDate ? endDate : undefined,
          projectTypeId: dto.projectTypeId ?? undefined,
          planId: touchesProvisioning ? planIds : undefined,
          hubId: touchesProvisioning ? hubIds : undefined,
          salesRepId:
            dto.salesRepId !== undefined ? (dto.salesRepId ?? null) : undefined,
          projectManagerId:
            dto.projectManagerId !== undefined
              ? (dto.projectManagerId ?? null)
              : undefined,
          engagementType:
            dto.engagementType !== undefined
              ? (dto.engagementType ?? null)
              : undefined,
          estimatedHours:
            dto.estimatedHours !== undefined
              ? (dto.estimatedHours ?? null)
              : undefined,
          estimatedDate:
            dto.estimatedDate !== undefined
              ? dto.estimatedDate
                ? new Date(dto.estimatedDate)
                : null
              : undefined,
        },
      });

      // An image the user removed from the description (kept in the DB row
      // and S3 as an inline attachment) is otherwise orphaned forever —
      // clean up whatever attachment ids dropped out between the old and
      // new text.
      if (dto.description !== undefined) {
        const oldIds = extractAttachmentIds(existing.description);
        const newIds = extractAttachmentIds(dto.description);
        const droppedIds = Array.from(oldIds).filter((id) => !newIds.has(id));
        if (droppedIds.length > 0) {
          await this.attachments.deleteByIds(workspaceId, droppedIds);
        }
      }

      if (touchesProvisioning) {
        await this.reconcileModuleInstances(tx, {
          project: updated,
          workspaceId,
          userId,
          startDate,
          endDate,
          existingInstances: existing.moduleInstances,
          isPlanAdd,
          planIds,
          selections: dto.moduleSelections,
        });
      }

      return updated;
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
