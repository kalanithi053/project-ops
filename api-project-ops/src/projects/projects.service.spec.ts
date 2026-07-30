import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
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
    userRole: { findFirst: jest.Mock };
    projectMember: { create: jest.Mock };
    ticketStatus: { findFirst: jest.Mock };
    module: { findMany: jest.Mock };
    workType: { findFirst: jest.Mock };
    moduleInstance: { create: jest.Mock };
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
      userRole: { findFirst: jest.fn() },
      projectMember: { create: jest.fn() },
      ticketStatus: { findFirst: jest.fn() },
      module: { findMany: jest.fn() },
      workType: { findFirst: jest.fn() },
      moduleInstance: { create: jest.fn() },
      workItem: { create: jest.fn() },
      activityLog: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    // Every $transaction call runs its callback against the same mock, so
    // tx.<model> calls inside the service land on the same jest.fn()s.
    prisma.$transaction.mockImplementation((cb: any) => cb(prisma));

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProjectsService, { provide: PrismaService, useValue: prisma }],
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

  const baseDto = (overrides: Partial<CreateProjectDto> = {}): CreateProjectDto => ({
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
          description: dto.description,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          ownerId: userId,
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
      const moduleInstance = { id: 'mi-1', projectId: created.id, moduleId: defaultModule.id };
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
        },
      });
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
      prisma.projectType.findFirst.mockResolvedValue(projectType({ isPlanAdd: true }));
      prisma.project.findMany.mockResolvedValue([]);
      prisma.plan.findMany.mockResolvedValue([]);

      await expect(
        service.create(workspaceId, userId, baseDto({ planId: [] })),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when startDate is before today', async () => {
      prisma.projectType.findFirst.mockResolvedValue(projectType({ isPlanAdd: false }));
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
      prisma.projectType.findFirst.mockResolvedValue(projectType({ isPlanAdd: false }));
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

      const result = service.list(workspaceId);

      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: { workspaceId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          projectType: { select: { id: true, name: true, isPlanAdd: true } },
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
          projectType: { select: { id: true, name: true, isPlanAdd: true } },
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

      const result = await service.update(workspaceId, projectId, dto);

      expect(result).toEqual(updated);
      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: {
          name: dto.name,
          description: dto.description,
          startDate: new Date(dto.startDate as string),
          endDate: new Date(dto.endDate as string),
        },
      });
    });

    it('passes undefined for omitted fields', async () => {
      prisma.project.findFirst.mockResolvedValue(existing);
      prisma.project.update.mockResolvedValue(existing);

      await service.update(workspaceId, projectId, {});

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
        service.update(workspaceId, projectId, {}),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.project.update).not.toHaveBeenCalled();
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
