import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProjectTypesService } from './project-types.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';
import { PLAN_TEMPLATES } from '../common/constants/workspace-defaults';

describe('ProjectTypesService', () => {
  let service: ProjectTypesService;
  let prisma: any;
  let plans: any;

  const workspaceId = 'ws-1';
  const projectTypeId = 'pt-1';

  const mockPrismaService = {
    projectType: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    project: {
      count: jest.fn(),
    },
  };

  const mockPlansService = {
    createPlan: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectTypesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PlansService, useValue: mockPlansService },
      ],
    }).compile();

    service = module.get<ProjectTypesService>(ProjectTypesService);
    prisma = module.get<PrismaService>(PrismaService);
    plans = module.get<PlansService>(PlansService);
  });

  describe('list', () => {
    it('lists project types with their plans', async () => {
      const types = [
        {
          id: projectTypeId,
          workspaceId,
          name: 'HubSpot',
          plans: [{ id: 'plan-1', name: 'Starter', isActive: true }],
        },
      ];
      mockPrismaService.projectType.findMany.mockResolvedValue(types);

      const result = await service.list(workspaceId);

      expect(prisma.projectType.findMany).toHaveBeenCalledWith({
        where: { workspaceId },
        orderBy: { name: 'asc' },
        include: {
          plans: { select: { id: true, name: true, isActive: true } },
        },
      });
      expect(result).toEqual(types);
    });
  });

  describe('create', () => {
    it('creates a plan-adding project type and seeds the plan templates', async () => {
      mockPrismaService.projectType.findFirst.mockResolvedValue(null); // name free
      const created = {
        id: projectTypeId,
        workspaceId,
        name: 'HubSpot',
        description: 'desc',
        isPlanAdd: true,
      };
      mockPrismaService.projectType.create.mockResolvedValue(created);
      mockPlansService.createPlan.mockResolvedValue({ id: 'plan-x' });

      const dto = { name: 'HubSpot', description: 'desc' };
      const result = await service.create(workspaceId, dto);

      expect(prisma.projectType.create).toHaveBeenCalledWith({
        data: {
          workspaceId,
          name: 'HubSpot',
          description: 'desc',
          isPlanAdd: true,
        },
      });
      expect(plans.createPlan).toHaveBeenCalledTimes(PLAN_TEMPLATES.length);
      expect(plans.createPlan).toHaveBeenCalledWith(workspaceId, {
        projectTypeId: created.id,
        name: PLAN_TEMPLATES[0].name,
        features: PLAN_TEMPLATES[0].features,
        isActive: false,
      });
      expect(result).toEqual(created);
    });

    it('does not seed plans for a non plan-adding project type', async () => {
      mockPrismaService.projectType.findFirst.mockResolvedValue(null);
      mockPrismaService.projectType.create.mockResolvedValue({
        id: projectTypeId,
        workspaceId,
        name: 'Development',
        isPlanAdd: false,
      });

      await service.create(workspaceId, {
        name: 'Development',
        isPlanAdd: false,
      });

      expect(plans.createPlan).not.toHaveBeenCalled();
    });

    it('defaults isPlanAdd to true when omitted', async () => {
      mockPrismaService.projectType.findFirst.mockResolvedValue(null);
      mockPrismaService.projectType.create.mockResolvedValue({
        id: projectTypeId,
        workspaceId,
        name: 'Standard',
        isPlanAdd: true,
      });
      mockPlansService.createPlan.mockResolvedValue({ id: 'plan-x' });

      await service.create(workspaceId, { name: 'Standard' });

      expect(prisma.projectType.create).toHaveBeenCalledWith({
        data: {
          workspaceId,
          name: 'Standard',
          description: undefined,
          isPlanAdd: true,
        },
      });
    });

    it('throws ConflictException when a project type with that name already exists', async () => {
      mockPrismaService.projectType.findFirst.mockResolvedValue({
        id: 'other-pt',
        name: 'HubSpot',
      });

      await expect(
        service.create(workspaceId, { name: 'HubSpot' } as any),
      ).rejects.toThrow(ConflictException);
      expect(prisma.projectType.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates a project type name and fields', async () => {
      mockPrismaService.projectType.findFirst
        .mockResolvedValueOnce({
          id: projectTypeId,
          workspaceId,
          name: 'Old Name',
        }) // getOwned
        .mockResolvedValueOnce(null); // assertNameFree
      mockPrismaService.projectType.update.mockResolvedValue({
        id: projectTypeId,
        name: 'New Name',
      });

      const result = await service.update(workspaceId, projectTypeId, {
        name: 'New Name',
      });

      expect(prisma.projectType.update).toHaveBeenCalledWith({
        where: { id: projectTypeId },
        data: {
          name: 'New Name',
          description: undefined,
          isPlanAdd: undefined,
        },
      });
      expect(result).toEqual({ id: projectTypeId, name: 'New Name' });
    });

    it('skips the name-uniqueness check when the name is unchanged', async () => {
      mockPrismaService.projectType.findFirst.mockResolvedValueOnce({
        id: projectTypeId,
        workspaceId,
        name: 'Same Name',
      });
      mockPrismaService.projectType.update.mockResolvedValue({
        id: projectTypeId,
        name: 'Same Name',
      });

      await service.update(workspaceId, projectTypeId, {
        name: 'Same Name',
      });

      expect(prisma.projectType.findFirst).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException when the project type does not belong to the workspace', async () => {
      mockPrismaService.projectType.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.update(workspaceId, projectTypeId, {
          name: 'New Name',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when renaming to a name already used by another type', async () => {
      mockPrismaService.projectType.findFirst
        .mockResolvedValueOnce({
          id: projectTypeId,
          workspaceId,
          name: 'Old Name',
        })
        .mockResolvedValueOnce({ id: 'other-pt', name: 'Taken Name' });

      await expect(
        service.update(workspaceId, projectTypeId, {
          name: 'Taken Name',
        } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('deletes a project type that is not in use', async () => {
      mockPrismaService.projectType.findFirst.mockResolvedValue({
        id: projectTypeId,
        workspaceId,
      });
      mockPrismaService.project.count.mockResolvedValue(0);
      mockPrismaService.projectType.delete.mockResolvedValue({
        id: projectTypeId,
      });

      const result = await service.remove(workspaceId, projectTypeId);

      expect(prisma.project.count).toHaveBeenCalledWith({
        where: { projectTypeId, deletedAt: null },
      });
      expect(prisma.projectType.delete).toHaveBeenCalledWith({
        where: { id: projectTypeId },
      });
      expect(result).toEqual({ id: projectTypeId, deleted: true });
    });

    it('throws NotFoundException when the project type does not belong to the workspace', async () => {
      mockPrismaService.projectType.findFirst.mockResolvedValue(null);

      await expect(service.remove(workspaceId, projectTypeId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.projectType.delete).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the project type is in use by active projects', async () => {
      mockPrismaService.projectType.findFirst.mockResolvedValue({
        id: projectTypeId,
        workspaceId,
      });
      mockPrismaService.project.count.mockResolvedValue(2);

      await expect(service.remove(workspaceId, projectTypeId)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.projectType.delete).not.toHaveBeenCalled();
    });
  });
});
