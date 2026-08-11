import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: {
    projectType: { findFirst: jest.Mock };
    project: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    plan: { findMany: jest.Mock };
    hub: { findMany: jest.Mock };
    workspaceMember: { findFirst: jest.Mock };
    priority: { findFirst: jest.Mock };
    userRole: { findFirst: jest.Mock };
    projectMember: { create: jest.Mock };
    ticketStatus: { findFirst: jest.Mock };
    module: { findMany: jest.Mock; findFirst: jest.Mock; create: jest.Mock };
    workType: { findFirst: jest.Mock };
    moduleInstance: {
      create: jest.Mock;
      update: jest.Mock;
      deleteMany: jest.Mock;
    };
    workItem: { create: jest.Mock };
    activityLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  const workspaceId = 'ws-1';
  const userId = 'user-1';

  // Fixed "future" window relative to the fake system date below.
  const futureStart = '2026-08-15T00:00:00.000Z';
  const futureEnd = '2026-09-15T00:00:00.000Z';

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-30T00:00:00.000Z'));

    prisma = {
      projectType: { findFirst: jest.fn() },
      project: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      plan: { findMany: jest.fn() },
      hub: { findMany: jest.fn() },
      workspaceMember: { findFirst: jest.fn() },
      priority: { findFirst: jest.fn() },
      userRole: { findFirst: jest.fn() },
      projectMember: { create: jest.fn() },
      ticketStatus: { findFirst: jest.fn() },
      module: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      workType: { findFirst: jest.fn() },
      moduleInstance: {
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      workItem: { create: jest.fn() },
      activityLog: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    // Every $transaction call runs its callback against the same mock, so
    // tx.<model> calls inside the service land on the same jest.fn()s.
    prisma.$transaction.mockImplementation((cb: any) => cb(prisma));

    const attachments = { deleteByIds: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AttachmentsService, useValue: attachments },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const projectType = (overrides: Partial<any> = {}) => ({
    id: 'ptype-1',
    workspaceId,
    name: 'Delivery',
    isPlanAdd: true,
    ...overrides,
  });

  const baseDto = (
    overrides: Partial<CreateProjectDto> = {},
  ): CreateProjectDto => ({
    name: 'Website Revamp',
    startDate: futureStart,
    endDate: futureEnd,
    projectTypeId: 'ptype-1',
    planId: ['plan-1'],
    description: 'A project',
    ...overrides,
  });

  describe('create', () => {
    it('creates a bare project without provisioning when the project type is not isPlanAdd', async () => {
      const type = projectType({ isPlanAdd: false });
      prisma.projectType.findFirst.mockResolvedValue(type);
      prisma.project.findMany.mockResolvedValue([]);
      prisma.plan.findMany.mockResolvedValue([]);
      const created = { id: 'proj-1' };
      prisma.project.create.mockResolvedValue(created);
      prisma.userRole.findFirst.mockResolvedValue({
        id: 'role-owner',
        name: 'Owner',
      });
      prisma.projectMember.create.mockResolvedValue({});
      const finalProject = { id: 'proj-1', name: 'Website Revamp' };
      prisma.project.findUnique.mockResolvedValue(finalProject);

      const dto = baseDto({ planId: [] });
      const result = await service.create(workspaceId, userId, dto);

      expect(result).toEqual(finalProject);
      expect(prisma.project.create).toHaveBeenCalledWith({
        data: {
          workspaceId,
          name: dto.name,
          projectTypeId: type.id,
          planId: [],
          hubId: [],
          description: dto.description,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          ownerId: userId,
          salesRepId: undefined,
          projectManagerId: undefined,
          engagementType: undefined,
          estimatedHours: undefined,
          estimatedDate: undefined,
        },
      });
      expect(prisma.projectMember.create).toHaveBeenCalledWith({
        data: {
          projectId: created.id,
          userId,
          roleId: 'role-owner',
          status: 'active',
          invitedBy: userId,
        },
      });
      expect(prisma.module.findMany).not.toHaveBeenCalled();
      expect(prisma.moduleInstance.create).not.toHaveBeenCalled();
    });

    it('provisions default modules, seed work items and activity logs when isPlanAdd is true', async () => {
      const type = projectType({ isPlanAdd: true });
      const plan = { id: 'plan-1', workspaceId };
      prisma.projectType.findFirst.mockResolvedValue(type);
      prisma.project.findMany.mockResolvedValue([]);
      prisma.plan.findMany.mockResolvedValue([plan]);
      const created = { id: 'proj-1' };
      prisma.project.create.mockResolvedValue(created);
      prisma.userRole.findFirst.mockResolvedValue({
        id: 'role-owner',
        name: 'Owner',
      });
      prisma.projectMember.create.mockResolvedValue({});
      prisma.priority.findFirst.mockResolvedValue({
        id: 'priority-default',
        isDefault: true,
      });
      prisma.ticketStatus.findFirst.mockResolvedValue({
        id: 'status-default',
        isDefault: true,
      });
      const defaultModule = {
        id: 'mod-1',
        name: 'Pipeline',
        defaultTaskLimit: 2,
      };
      prisma.module.findMany.mockResolvedValue([defaultModule]);
      prisma.workType.findFirst.mockResolvedValue({
        id: 'wtype-1',
        category: 'task',
      });
      const moduleInstance = {
        id: 'mi-1',
        projectId: created.id,
        moduleId: defaultModule.id,
      };
      prisma.moduleInstance.create.mockResolvedValue(moduleInstance);
      prisma.workItem.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: `wi-${data.prefix}`, ...data }),
      );
      prisma.activityLog.create.mockResolvedValue({});
      const finalProject = { id: created.id, name: 'Website Revamp' };
      prisma.project.findUnique.mockResolvedValue(finalProject);

      const dto = baseDto({ planId: [plan.id] });
      const result = await service.create(workspaceId, userId, dto);

      expect(result).toEqual(finalProject);
      expect(prisma.moduleInstance.create).toHaveBeenCalledWith({
        data: {
          projectId: created.id,
          moduleId: defaultModule.id,
          taskLimit: defaultModule.defaultTaskLimit,
        },
      });
      // defaultTaskLimit is 2, so two work items + two activity logs.
      expect(prisma.workItem.create).toHaveBeenCalledTimes(2);
      expect(prisma.activityLog.create).toHaveBeenCalledTimes(2);
      expect(prisma.workItem.create).toHaveBeenNthCalledWith(1, {
        data: {
          projectId: created.id,
          moduleInstanceId: moduleInstance.id,
          workItemTypeId: 'wtype-1',
          prefix: 'Pipeline-1',
          name: defaultModule.name,
          startDate: new Date(dto.startDate),
          dueDate: new Date(dto.endDate),
          statusId: 'status-default',
          createdBy: userId,
          assigneeId: userId,
          priorityId: 'priority-default',
          position: 0,
        },
      });
      // Spaced apart, not dense — see POSITION_GAP's own doc comment.
      expect(prisma.workItem.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          data: expect.objectContaining({ position: 1000 }),
        }),
      );
      expect(prisma.activityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId,
          projectId: created.id,
          entityType: 'task',
          action: 'created',
          userId,
        }),
      });
    });

    describe('with explicit moduleSelections', () => {
      const plan = { id: 'plan-1', workspaceId };

      function primeCommonMocks() {
        prisma.projectType.findFirst.mockResolvedValue(
          projectType({ isPlanAdd: true }),
        );
        prisma.project.findMany.mockResolvedValue([]);
        prisma.plan.findMany.mockResolvedValue([plan]);
        prisma.project.create.mockResolvedValue({ id: 'proj-1' });
        prisma.userRole.findFirst.mockResolvedValue({
          id: 'role-owner',
          name: 'Owner',
        });
        prisma.projectMember.create.mockResolvedValue({});
        prisma.priority.findFirst.mockResolvedValue({
          id: 'priority-default',
          isDefault: true,
        });
        prisma.ticketStatus.findFirst.mockResolvedValue({
          id: 'status-default',
          isDefault: true,
        });
        prisma.workType.findFirst.mockResolvedValue({
          id: 'wtype-1',
          category: 'task',
        });
        prisma.workItem.create.mockImplementation(({ data }: any) =>
          Promise.resolve({ id: `wi-${data.prefix}`, ...data }),
        );
        prisma.activityLog.create.mockResolvedValue({});
        prisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      }

      it('uses the selection’s task count instead of the module’s catalog default, and skips the isDefault lookup entirely', async () => {
        primeCommonMocks();
        const existingModule = {
          id: 'mod-1',
          planId: plan.id,
          name: 'Meetings',
          defaultTaskLimit: 5,
        };
        prisma.module.findFirst.mockResolvedValue(existingModule);
        prisma.moduleInstance.create.mockResolvedValue({
          id: 'mi-1',
          projectId: 'proj-1',
          moduleId: existingModule.id,
        });

        const dto = baseDto({
          planId: [plan.id],
          moduleSelections: [{ moduleId: existingModule.id, taskLimit: 8 }],
        });
        await service.create(workspaceId, userId, dto);

        expect(prisma.module.findMany).not.toHaveBeenCalled();
        expect(prisma.moduleInstance.create).toHaveBeenCalledWith({
          data: {
            projectId: 'proj-1',
            moduleId: existingModule.id,
            taskLimit: 8,
          },
        });
        expect(prisma.workItem.create).toHaveBeenCalledTimes(8);
      });

      it('creates a brand-new catalog module (isDefault: false) when a selection has no moduleId', async () => {
        primeCommonMocks();
        prisma.module.findFirst.mockResolvedValue(null); // no key collision
        const created = {
          id: 'mod-new',
          planId: plan.id,
          name: 'Client Workshops',
          defaultTaskLimit: 3,
        };
        prisma.module.create.mockResolvedValue(created);
        prisma.moduleInstance.create.mockResolvedValue({
          id: 'mi-new',
          projectId: 'proj-1',
          moduleId: created.id,
        });

        const dto = baseDto({
          planId: [plan.id],
          moduleSelections: [
            { planId: plan.id, name: 'Client Workshops', taskLimit: 3 },
          ],
        });
        await service.create(workspaceId, userId, dto);

        expect(prisma.module.create).toHaveBeenCalledWith({
          data: {
            workspaceId,
            planId: plan.id,
            key: 'client_workshops',
            name: 'Client Workshops',
            defaultTaskLimit: 3,
            isDefault: false,
            isActive: true,
          },
        });
        expect(prisma.moduleInstance.create).toHaveBeenCalledWith({
          data: { projectId: 'proj-1', moduleId: created.id, taskLimit: 3 },
        });
      });

      it('throws BadRequestException when an existing-module selection does not belong to a selected plan', async () => {
        primeCommonMocks();
        prisma.module.findFirst.mockResolvedValue({
          id: 'mod-1',
          planId: 'some-other-plan',
          name: 'Meetings',
        });

        const dto = baseDto({
          planId: [plan.id],
          moduleSelections: [{ moduleId: 'mod-1', taskLimit: 5 }],
        });
        await expect(service.create(workspaceId, userId, dto)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('throws BadRequestException when a new module selection is missing planId or name', async () => {
        primeCommonMocks();

        const dto = baseDto({
          planId: [plan.id],
          moduleSelections: [{ taskLimit: 5 }],
        });
        await expect(service.create(workspaceId, userId, dto)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('throws ConflictException when a new module’s derived key already exists on that plan', async () => {
        primeCommonMocks();
        prisma.module.findFirst.mockResolvedValue({
          id: 'mod-existing',
          planId: plan.id,
          key: 'meetings',
          name: 'Meetings',
        });

        const dto = baseDto({
          planId: [plan.id],
          moduleSelections: [
            { planId: plan.id, name: 'Meetings', taskLimit: 5 },
          ],
        });
        await expect(service.create(workspaceId, userId, dto)).rejects.toThrow(
          ConflictException,
        );
        expect(prisma.module.create).not.toHaveBeenCalled();
      });
    });

    it('falls back to the workspace default role when there is no Owner role', async () => {
      const type = projectType({ isPlanAdd: false });
      prisma.projectType.findFirst.mockResolvedValue(type);
      prisma.project.findMany.mockResolvedValue([]);
      prisma.plan.findMany.mockResolvedValue([]);
      prisma.project.create.mockResolvedValue({ id: 'proj-1' });
      prisma.userRole.findFirst
        .mockResolvedValueOnce(null) // no 'Owner' role
        .mockResolvedValueOnce({ id: 'role-default', isDefault: true });
      prisma.projectMember.create.mockResolvedValue({});
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });

      await service.create(workspaceId, userId, baseDto({ planId: [] }));

      expect(prisma.projectMember.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ roleId: 'role-default' }),
      });
    });

    it('skips ProjectMember creation when the workspace has no Owner or default role', async () => {
      const type = projectType({ isPlanAdd: false });
      prisma.projectType.findFirst.mockResolvedValue(type);
      prisma.project.findMany.mockResolvedValue([]);
      prisma.plan.findMany.mockResolvedValue([]);
      prisma.project.create.mockResolvedValue({ id: 'proj-1' });
      prisma.userRole.findFirst.mockResolvedValue(null);
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });

      await service.create(workspaceId, userId, baseDto({ planId: [] }));

      expect(prisma.projectMember.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when a project with the same name already exists in the workspace', async () => {
      prisma.projectType.findFirst.mockResolvedValue(projectType());
      prisma.project.findMany.mockResolvedValue([{ id: 'existing' }]);

      await expect(
        service.create(workspaceId, userId, baseDto()),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the project type is not found in the workspace', async () => {
      prisma.projectType.findFirst.mockResolvedValue(null);
      prisma.project.findMany.mockResolvedValue([]);

      await expect(
        service.create(workspaceId, userId, baseDto()),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when one or more selected plans are not found in the workspace', async () => {
      prisma.projectType.findFirst.mockResolvedValue(projectType());
      prisma.project.findMany.mockResolvedValue([]);
      // Only one of the two requested plans exists.
      prisma.plan.findMany.mockResolvedValue([{ id: 'plan-1', workspaceId }]);

      await expect(
        service.create(
          workspaceId,
          userId,
          baseDto({ planId: ['plan-1', 'plan-2'] }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when isPlanAdd is true and no plans are selected', async () => {
      prisma.projectType.findFirst.mockResolvedValue(
        projectType({ isPlanAdd: true }),
      );
      prisma.project.findMany.mockResolvedValue([]);
      prisma.plan.findMany.mockResolvedValue([]);

      await expect(
        service.create(workspaceId, userId, baseDto({ planId: [] })),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when one or more selected hubs are not found in the workspace', async () => {
      prisma.projectType.findFirst.mockResolvedValue(
        projectType({ isPlanAdd: false }),
      );
      prisma.project.findMany.mockResolvedValue([]);
      prisma.plan.findMany.mockResolvedValue([]);
      // Only one of the two requested hubs exists.
      prisma.hub.findMany.mockResolvedValue([{ id: 'hub-1', workspaceId }]);

      await expect(
        service.create(
          workspaceId,
          userId,
          baseDto({ planId: [], hubId: ['hub-1', 'hub-2'] }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when a selected plan's hub is not in the selected hubs", async () => {
      prisma.projectType.findFirst.mockResolvedValue(
        projectType({ isPlanAdd: true }),
      );
      prisma.project.findMany.mockResolvedValue([]);
      // The plan belongs to hub-1, but hub-1 isn't in the submitted hubId list.
      prisma.plan.findMany.mockResolvedValue([
        { id: 'plan-1', workspaceId, hubId: 'hub-1' },
      ]);
      prisma.hub.findMany.mockResolvedValue([{ id: 'hub-2', workspaceId }]);

      await expect(
        service.create(
          workspaceId,
          userId,
          baseDto({ planId: ['plan-1'], hubId: ['hub-2'] }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when estimatedDate is set for a time_and_material engagement', async () => {
      prisma.projectType.findFirst.mockResolvedValue(
        projectType({ isPlanAdd: false }),
      );
      prisma.project.findMany.mockResolvedValue([]);
      prisma.plan.findMany.mockResolvedValue([]);

      await expect(
        service.create(
          workspaceId,
          userId,
          baseDto({
            planId: [],
            engagementType: 'time_and_material',
            estimatedDate: futureEnd,
          }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when estimatedHours is set for a fixed_budget engagement', async () => {
      prisma.projectType.findFirst.mockResolvedValue(
        projectType({ isPlanAdd: false }),
      );
      prisma.project.findMany.mockResolvedValue([]);
      prisma.plan.findMany.mockResolvedValue([]);

      await expect(
        service.create(
          workspaceId,
          userId,
          baseDto({
            planId: [],
            engagementType: 'fixed_budget',
            estimatedHours: 40,
          }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when an estimation is set without an engagementType', async () => {
      prisma.projectType.findFirst.mockResolvedValue(
        projectType({ isPlanAdd: false }),
      );
      prisma.project.findMany.mockResolvedValue([]);
      prisma.plan.findMany.mockResolvedValue([]);

      await expect(
        service.create(
          workspaceId,
          userId,
          baseDto({ planId: [], estimatedHours: 40 }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when salesRepId is not an active workspace member', async () => {
      prisma.projectType.findFirst.mockResolvedValue(
        projectType({ isPlanAdd: false }),
      );
      prisma.project.findMany.mockResolvedValue([]);
      prisma.plan.findMany.mockResolvedValue([]);
      prisma.workspaceMember.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          workspaceId,
          userId,
          baseDto({ planId: [], salesRepId: 'user-2' }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when projectManagerId is not an active workspace member', async () => {
      prisma.projectType.findFirst.mockResolvedValue(
        projectType({ isPlanAdd: false }),
      );
      prisma.project.findMany.mockResolvedValue([]);
      prisma.plan.findMany.mockResolvedValue([]);
      prisma.workspaceMember.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          workspaceId,
          userId,
          baseDto({ planId: [], projectManagerId: 'user-3' }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('persists hub/plan/person/engagement fields on the happy path', async () => {
      const type = projectType({ isPlanAdd: true });
      prisma.projectType.findFirst.mockResolvedValue(type);
      prisma.project.findMany.mockResolvedValue([]);
      prisma.plan.findMany.mockResolvedValue([
        { id: 'plan-1', workspaceId, hubId: 'hub-1' },
      ]);
      prisma.hub.findMany.mockResolvedValue([{ id: 'hub-1', workspaceId }]);
      prisma.workspaceMember.findFirst.mockResolvedValue({ id: 'member-1' });
      prisma.project.create.mockResolvedValue({ id: 'proj-1' });
      prisma.userRole.findFirst.mockResolvedValue({
        id: 'role-owner',
        name: 'Owner',
      });
      prisma.projectMember.create.mockResolvedValue({});
      prisma.module.findMany.mockResolvedValue([]);
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });

      const dto = baseDto({
        planId: ['plan-1'],
        hubId: ['hub-1'],
        salesRepId: 'user-2',
        projectManagerId: 'user-3',
        engagementType: 'time_and_material',
        estimatedHours: 120,
      });
      await service.create(workspaceId, userId, dto);

      expect(prisma.project.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          hubId: ['hub-1'],
          salesRepId: 'user-2',
          projectManagerId: 'user-3',
          engagementType: 'time_and_material',
          estimatedHours: 120,
          estimatedDate: undefined,
        }),
      });
    });

    it('throws BadRequestException when startDate is before today', async () => {
      prisma.projectType.findFirst.mockResolvedValue(
        projectType({ isPlanAdd: false }),
      );
      prisma.project.findMany.mockResolvedValue([]);
      prisma.plan.findMany.mockResolvedValue([]);

      await expect(
        service.create(
          workspaceId,
          userId,
          baseDto({ planId: [], startDate: '2020-01-01T00:00:00.000Z' }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when endDate is before today', async () => {
      prisma.projectType.findFirst.mockResolvedValue(
        projectType({ isPlanAdd: false }),
      );
      prisma.project.findMany.mockResolvedValue([]);
      prisma.plan.findMany.mockResolvedValue([]);

      await expect(
        service.create(
          workspaceId,
          userId,
          baseDto({ planId: [], endDate: '2020-01-01T00:00:00.000Z' }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('returns non-deleted workspace projects on the happy path', () => {
      const projects = [{ id: 'proj-1', workspaceId, deletedAt: null }];
      prisma.project.findMany.mockResolvedValue(projects);

      const result = service.list(workspaceId, userId);

      expect(prisma.project.findMany).toHaveBeenCalledWith({
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
          salesRep: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          projectManager: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          _count: { select: { members: true } },
        },
      });
      return expect(result).resolves.toEqual(projects);
    });
  });

  describe('findOne', () => {
    const projectId = 'proj-1';

    it('returns the project with relations on the happy path', async () => {
      const found = { id: projectId, workspaceId, deletedAt: null };
      prisma.project.findFirst.mockResolvedValue(found);

      const result = await service.findOne(workspaceId, projectId);

      expect(result).toEqual(found);
      expect(prisma.project.findFirst).toHaveBeenCalledWith({
        where: { id: projectId, workspaceId, deletedAt: null },
        include: {
          projectType: {
            select: { id: true, name: true, isPlanAdd: true, color: true },
          },
          salesRep: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          projectManager: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          moduleInstances: { include: { module: true } },
          members: {
            include: { user: { select: { id: true, email: true } } },
          },
        },
      });
    });

    it('throws NotFoundException when the project does not exist', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.findOne(workspaceId, projectId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const projectId = 'proj-1';
    const existing = { id: projectId, workspaceId, deletedAt: null };

    it('updates the provided fields on the happy path', async () => {
      prisma.project.findFirst.mockResolvedValue(existing);
      const dto: UpdateProjectDto = {
        name: 'Renamed',
        description: 'Updated desc',
        startDate: futureStart,
        endDate: futureEnd,
      };
      const updated = { ...existing, ...dto };
      prisma.project.update.mockResolvedValue(updated);

      const result = await service.update(workspaceId, projectId, dto, userId);

      expect(result).toEqual(updated);
      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: {
          name: dto.name,
          description: dto.description,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
        },
      });
    });

    it('passes undefined for omitted fields', async () => {
      prisma.project.findFirst.mockResolvedValue(existing);
      prisma.project.update.mockResolvedValue(existing);

      await service.update(workspaceId, projectId, {}, userId);

      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: {
          name: undefined,
          description: undefined,
          startDate: undefined,
          endDate: undefined,
        },
      });
    });

    it('throws NotFoundException when the project does not exist', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.update(workspaceId, projectId, {}, userId),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.project.update).not.toHaveBeenCalled();
    });

    it('sets sales rep, project manager, and engagement estimate', async () => {
      prisma.project.findFirst.mockResolvedValue(existing);
      prisma.workspaceMember.findFirst.mockResolvedValue({ id: 'wm-1' });
      prisma.project.update.mockResolvedValue(existing);
      const dto: UpdateProjectDto = {
        salesRepId: 'user-2',
        projectManagerId: 'user-3',
        engagementType: 'time_and_material',
        estimatedHours: 40,
      };

      await service.update(workspaceId, projectId, dto, userId);

      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: {
          name: undefined,
          description: undefined,
          startDate: undefined,
          endDate: undefined,
          salesRepId: 'user-2',
          projectManagerId: 'user-3',
          engagementType: 'time_and_material',
          estimatedHours: 40,
          estimatedDate: undefined,
        },
      });
    });

    it('clears sales rep, PM, and engagement estimate when given null', async () => {
      const populated = {
        ...existing,
        salesRepId: 'user-2',
        projectManagerId: 'user-3',
        engagementType: 'time_and_material',
        estimatedHours: 40,
        estimatedDate: null,
      };
      prisma.project.findFirst.mockResolvedValue(populated);
      prisma.project.update.mockResolvedValue(populated);
      const dto: UpdateProjectDto = {
        salesRepId: null,
        projectManagerId: null,
        engagementType: null,
        estimatedHours: null,
      };

      await service.update(workspaceId, projectId, dto, userId);

      expect(prisma.workspaceMember.findFirst).not.toHaveBeenCalled();
      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: {
          name: undefined,
          description: undefined,
          startDate: undefined,
          endDate: undefined,
          salesRepId: null,
          projectManagerId: null,
          engagementType: null,
          estimatedHours: null,
          estimatedDate: undefined,
        },
      });
    });

    it('validates a partial estimate edit against the existing engagementType', async () => {
      const populated = {
        ...existing,
        engagementType: 'fixed_budget',
        estimatedDate: new Date(futureEnd),
      };
      prisma.project.findFirst.mockResolvedValue(populated);

      // Setting estimatedHours without changing engagementType away from
      // fixed_budget must fail, the same as it would on create.
      await expect(
        service.update(workspaceId, projectId, { estimatedHours: 10 }, userId),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.project.update).not.toHaveBeenCalled();
    });

    it('throws when the new endDate is before the existing startDate', async () => {
      const populated = {
        ...existing,
        startDate: new Date(futureStart),
        endDate: new Date(futureEnd),
      };
      prisma.project.findFirst.mockResolvedValue(populated);

      await expect(
        service.update(
          workspaceId,
          projectId,
          { endDate: '2020-01-01T00:00:00.000Z' },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.project.update).not.toHaveBeenCalled();
    });

    it('rejects a sales rep who is not an active workspace member', async () => {
      prisma.project.findFirst.mockResolvedValue(existing);
      prisma.workspaceMember.findFirst.mockResolvedValue(null);

      await expect(
        service.update(
          workspaceId,
          projectId,
          { salesRepId: 'user-9' },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.project.update).not.toHaveBeenCalled();
    });

    describe('project type / hubs / plans / modules', () => {
      const plan = { id: 'plan-1', workspaceId, hubId: null };

      function primeSeedMocks() {
        prisma.priority.findFirst.mockResolvedValue({
          id: 'priority-default',
          isDefault: true,
        });
        prisma.ticketStatus.findFirst.mockResolvedValue({
          id: 'status-default',
          isDefault: true,
        });
        prisma.workType.findFirst.mockResolvedValue({
          id: 'wtype-1',
          category: 'task',
        });
        prisma.workItem.create.mockImplementation(({ data }: any) =>
          Promise.resolve({ id: `wi-${data.prefix}`, ...data }),
        );
        prisma.activityLog.create.mockResolvedValue({});
      }

      it('keeps a still-selected module instance and only adjusts its taskLimit', async () => {
        const existingInstance = {
          id: 'mi-1',
          moduleId: 'mod-1',
          taskLimit: 5,
        };
        const populated = {
          ...existing,
          projectTypeId: 'ptype-1',
          planId: [plan.id],
          hubId: [],
          moduleInstances: [existingInstance],
        };
        prisma.project.findFirst.mockResolvedValue(populated);
        prisma.projectType.findFirst.mockResolvedValue({
          id: 'ptype-1',
          isPlanAdd: true,
        });
        prisma.plan.findMany.mockResolvedValue([plan]);
        prisma.module.findFirst.mockResolvedValue({
          id: 'mod-1',
          name: 'Pipeline',
          planId: plan.id,
        });
        prisma.project.update.mockResolvedValue(populated);

        await service.update(
          workspaceId,
          projectId,
          {
            planId: [plan.id],
            moduleSelections: [{ moduleId: 'mod-1', taskLimit: 8 }],
          },
          userId,
        );

        expect(prisma.moduleInstance.update).toHaveBeenCalledWith({
          where: { id: 'mi-1' },
          data: { taskLimit: 8 },
        });
        expect(prisma.moduleInstance.create).not.toHaveBeenCalled();
        expect(prisma.moduleInstance.deleteMany).not.toHaveBeenCalled();
      });

      it('swaps a deselected module for a newly attached one, seeding it like create() does', async () => {
        const existingInstance = {
          id: 'mi-1',
          moduleId: 'mod-1',
          taskLimit: 5,
        };
        const populated = {
          ...existing,
          projectTypeId: 'ptype-1',
          planId: [plan.id],
          hubId: [],
          moduleInstances: [existingInstance],
        };
        prisma.project.findFirst.mockResolvedValue(populated);
        prisma.projectType.findFirst.mockResolvedValue({
          id: 'ptype-1',
          isPlanAdd: true,
        });
        prisma.plan.findMany.mockResolvedValue([plan]);
        prisma.module.findFirst.mockResolvedValue({
          id: 'mod-2',
          name: 'Design',
          planId: plan.id,
        });
        prisma.project.update.mockResolvedValue(populated);
        prisma.moduleInstance.create.mockResolvedValue({ id: 'mi-2' });
        primeSeedMocks();

        await service.update(
          workspaceId,
          projectId,
          {
            planId: [plan.id],
            moduleSelections: [{ moduleId: 'mod-2', taskLimit: 2 }],
          },
          userId,
        );

        expect(prisma.moduleInstance.create).toHaveBeenCalledWith({
          data: { projectId, moduleId: 'mod-2', taskLimit: 2 },
        });
        expect(prisma.workItem.create).toHaveBeenCalledTimes(2);
        expect(prisma.moduleInstance.deleteMany).toHaveBeenCalledWith({
          where: { id: { in: ['mi-1'] } },
        });
      });

      it('clears every module instance when switching to a non-plan-add project type', async () => {
        const existingInstance = {
          id: 'mi-1',
          moduleId: 'mod-1',
          taskLimit: 5,
        };
        const populated = {
          ...existing,
          projectTypeId: 'ptype-1',
          planId: [plan.id],
          hubId: [],
          moduleInstances: [existingInstance],
        };
        prisma.project.findFirst.mockResolvedValue(populated);
        prisma.projectType.findFirst.mockResolvedValue({
          id: 'ptype-2',
          isPlanAdd: false,
        });
        prisma.project.update.mockResolvedValue({
          ...populated,
          projectTypeId: 'ptype-2',
          planId: [],
          hubId: [],
        });

        await service.update(
          workspaceId,
          projectId,
          { projectTypeId: 'ptype-2' },
          userId,
        );

        expect(prisma.plan.findMany).not.toHaveBeenCalled();
        expect(prisma.project.update).toHaveBeenCalledWith({
          where: { id: projectId },
          data: expect.objectContaining({
            projectTypeId: 'ptype-2',
            planId: [],
            hubId: [],
          }),
        });
        expect(prisma.moduleInstance.deleteMany).toHaveBeenCalledWith({
          where: { id: { in: ['mi-1'] } },
        });
      });

      it('requires at least one plan when clearing plans on an isPlanAdd type', async () => {
        const populated = {
          ...existing,
          projectTypeId: 'ptype-1',
          planId: [plan.id],
          hubId: [],
          moduleInstances: [],
        };
        prisma.project.findFirst.mockResolvedValue(populated);
        prisma.projectType.findFirst.mockResolvedValue({
          id: 'ptype-1',
          isPlanAdd: true,
        });

        await expect(
          service.update(workspaceId, projectId, { planId: [] }, userId),
        ).rejects.toThrow(BadRequestException);
        expect(prisma.project.update).not.toHaveBeenCalled();
      });
    });
  });

  describe('remove', () => {
    const projectId = 'proj-1';
    const existing = { id: projectId, workspaceId, deletedAt: null };

    it('soft-deletes the project on the happy path', async () => {
      prisma.project.findFirst.mockResolvedValue(existing);
      prisma.project.update.mockResolvedValue({
        ...existing,
        deletedAt: new Date(),
      });

      const result = await service.remove(workspaceId, projectId);

      expect(result).toEqual({ id: projectId, deleted: true });
      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('throws NotFoundException when the project does not exist', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.remove(workspaceId, projectId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.project.update).not.toHaveBeenCalled();
    });
  });
});
