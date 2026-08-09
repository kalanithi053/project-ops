import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PlansService } from './plans.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PlansService', () => {
  let service: PlansService;
  let prisma: any;

  const workspaceId = 'ws-1';
  const projectTypeId = 'pt-1';
  const planId = 'plan-1';

  const mockPrismaService = {
    projectType: {
      findFirst: jest.fn(),
    },
    plan: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    module: {
      createMany: jest.fn(),
    },
    hub: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPrismaService.$transaction.mockImplementation((cb: any) =>
      cb(mockPrismaService),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlansService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PlansService>(PlansService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('createPlan', () => {
    it('creates a plan and seeds the default modules', async () => {
      mockPrismaService.projectType.findFirst.mockResolvedValue({
        id: projectTypeId,
        workspaceId,
        name: 'HubSpot',
      });
      mockPrismaService.plan.findFirst.mockResolvedValue(null); // name free
      mockPrismaService.plan.create.mockResolvedValue({
        id: planId,
        workspaceId,
        projectTypeId,
        name: 'Starter',
        features: {},
        isActive: true,
      });
      mockPrismaService.module.createMany.mockResolvedValue({ count: 9 });

      const dto = { projectTypeId, name: 'Starter' };
      const result = await service.createPlan(workspaceId, dto);

      expect(prisma.projectType.findFirst).toHaveBeenCalledWith({
        where: { id: projectTypeId, workspaceId },
      });
      expect(prisma.plan.findFirst).toHaveBeenCalledWith({
        where: { projectTypeId, name: 'Starter' },
      });
      expect(prisma.plan.create).toHaveBeenCalledWith({
        data: {
          workspaceId,
          projectTypeId,
          name: 'Starter',
          features: {},
          isActive: true,
        },
      });
      expect(prisma.module.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ skipDuplicates: true }),
      );
      expect(result).toEqual({
        id: planId,
        workspaceId,
        projectTypeId,
        name: 'Starter',
        features: {},
        isActive: true,
      });
    });

    it('defaults isActive to true and features to {} when omitted', async () => {
      mockPrismaService.projectType.findFirst.mockResolvedValue({
        id: projectTypeId,
        workspaceId,
      });
      mockPrismaService.plan.findFirst.mockResolvedValue(null);
      mockPrismaService.plan.create.mockResolvedValue({ id: planId });

      await service.createPlan(workspaceId, {
        projectTypeId,
        name: 'Starter',
      });

      expect(prisma.plan.create).toHaveBeenCalledWith({
        data: {
          workspaceId,
          projectTypeId,
          name: 'Starter',
          features: {},
          isActive: true,
        },
      });
    });

    it('throws BadRequestException when the project type is not in the workspace', async () => {
      mockPrismaService.projectType.findFirst.mockResolvedValue(null);

      await expect(
        service.createPlan(workspaceId, {
          projectTypeId,
          name: 'Starter',
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.plan.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when a plan with that name already exists for the project type', async () => {
      mockPrismaService.projectType.findFirst.mockResolvedValue({
        id: projectTypeId,
        workspaceId,
      });
      mockPrismaService.plan.findFirst.mockResolvedValue({
        id: 'existing-plan',
        name: 'Starter',
      });

      await expect(
        service.createPlan(workspaceId, {
          projectTypeId,
          name: 'Starter',
        } as any),
      ).rejects.toThrow(ConflictException);
      expect(prisma.plan.create).not.toHaveBeenCalled();
    });

    it('scopes the plan to a hub when hubId is given and valid', async () => {
      mockPrismaService.projectType.findFirst.mockResolvedValue({
        id: projectTypeId,
        workspaceId,
      });
      mockPrismaService.plan.findFirst.mockResolvedValue(null);
      mockPrismaService.hub.findFirst.mockResolvedValue({
        id: 'hub-1',
        workspaceId,
        projectTypeId,
      });
      mockPrismaService.plan.create.mockResolvedValue({
        id: planId,
        hubId: 'hub-1',
      });

      await service.createPlan(workspaceId, {
        projectTypeId,
        name: 'Enterprise',
        hubId: 'hub-1',
      });

      expect(prisma.hub.findFirst).toHaveBeenCalledWith({
        where: { id: 'hub-1', workspaceId, projectTypeId },
      });
      expect(prisma.plan.create).toHaveBeenCalledWith({
        data: {
          workspaceId,
          projectTypeId,
          hubId: 'hub-1',
          name: 'Enterprise',
          features: {},
          isActive: true,
        },
      });
    });

    it('throws BadRequestException when hubId does not belong to the workspace/project type', async () => {
      mockPrismaService.projectType.findFirst.mockResolvedValue({
        id: projectTypeId,
        workspaceId,
      });
      mockPrismaService.plan.findFirst.mockResolvedValue(null);
      mockPrismaService.hub.findFirst.mockResolvedValue(null);

      await expect(
        service.createPlan(workspaceId, {
          projectTypeId,
          name: 'Enterprise',
          hubId: 'hub-x',
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.plan.create).not.toHaveBeenCalled();
    });
  });

  describe('getActivePlans', () => {
    it('returns all active plans for the workspace with project type', async () => {
      const plans = [
        {
          id: planId,
          workspaceId,
          isActive: true,
          projectType: { id: projectTypeId, name: 'HubSpot' },
        },
      ];
      mockPrismaService.plan.findMany.mockResolvedValue(plans);

      const result = await service.getActivePlans(workspaceId);

      expect(prisma.plan.findMany).toHaveBeenCalledWith({
        where: { workspaceId, isActive: true },
        orderBy: { name: 'asc' },
        include: { projectType: { select: { id: true, name: true } } },
      });
      expect(result).toEqual(plans);
    });
  });

  describe('getActivePlan', () => {
    it('returns the first active plan for the workspace', async () => {
      const plan = { id: planId, workspaceId, isActive: true };
      mockPrismaService.plan.findFirst.mockResolvedValue(plan);

      const result = await service.getActivePlan(workspaceId);

      expect(prisma.plan.findFirst).toHaveBeenCalledWith({
        where: { workspaceId, isActive: true },
        orderBy: { id: 'asc' },
      });
      expect(result).toEqual(plan);
    });

    it('throws NotFoundException when there is no active plan', async () => {
      mockPrismaService.plan.findFirst.mockResolvedValue(null);

      await expect(service.getActivePlan(workspaceId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getPlan', () => {
    it('returns null immediately when no planId is given', async () => {
      const result = await service.getPlan(workspaceId, undefined);

      expect(result).toBeNull();
      expect(prisma.plan.findFirst).not.toHaveBeenCalled();
    });

    it('returns the plan when found in the workspace', async () => {
      const plan = { id: planId, workspaceId };
      mockPrismaService.plan.findFirst.mockResolvedValue(plan);

      const result = await service.getPlan(workspaceId, planId);

      expect(prisma.plan.findFirst).toHaveBeenCalledWith({
        where: { id: planId, workspaceId },
      });
      expect(result).toEqual(plan);
    });

    it('throws NotFoundException when the plan is not in the workspace', async () => {
      mockPrismaService.plan.findFirst.mockResolvedValue(null);

      await expect(service.getPlan(workspaceId, planId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listPlans', () => {
    it('lists plans for a project type in the workspace', async () => {
      const plans = [{ id: planId, workspaceId, projectTypeId }];
      mockPrismaService.plan.findMany.mockResolvedValue(plans);

      const result = await service.listPlans(workspaceId, projectTypeId);

      expect(prisma.plan.findMany).toHaveBeenCalledWith({
        where: { workspaceId, projectTypeId },
        include: { hub: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(plans);
    });

    it('throws BadRequestException when projectTypeId is missing', async () => {
      await expect(service.listPlans(workspaceId, undefined)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.plan.findMany).not.toHaveBeenCalled();
    });
  });

  describe('activatePlan', () => {
    it('activates the given plan', async () => {
      mockPrismaService.plan.findFirst.mockResolvedValue({
        id: planId,
        workspaceId,
      });
      mockPrismaService.plan.update.mockResolvedValue({
        id: planId,
        isActive: true,
      });

      const result = await service.activatePlan(workspaceId, planId);

      expect(prisma.plan.findFirst).toHaveBeenCalledWith({
        where: { id: planId, workspaceId },
      });
      expect(prisma.plan.update).toHaveBeenCalledWith({
        where: { id: planId },
        data: { isActive: true },
      });
      expect(result).toEqual({ id: planId, isActive: true });
    });

    it('throws NotFoundException when the plan is not in the workspace', async () => {
      mockPrismaService.plan.findFirst.mockResolvedValue(null);

      await expect(service.activatePlan(workspaceId, planId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.plan.update).not.toHaveBeenCalled();
    });
  });

  describe('updatePlanDetails', () => {
    it('renames a plan', async () => {
      mockPrismaService.plan.findFirst
        .mockResolvedValueOnce({
          id: planId,
          workspaceId,
          projectTypeId,
          name: 'Old Name',
        }) // getOwned
        .mockResolvedValueOnce(null); // name-uniqueness check
      mockPrismaService.plan.update.mockResolvedValue({
        id: planId,
        name: 'New Name',
      });

      const result = await service.updatePlanDetails(workspaceId, planId, {
        name: 'New Name',
      });

      expect(prisma.plan.update).toHaveBeenCalledWith({
        where: { id: planId },
        data: { name: 'New Name', features: undefined, hubId: undefined },
      });
      expect(result).toEqual({ id: planId, name: 'New Name' });
    });

    it('reassigns the plan to a hub in the same workspace and project type', async () => {
      mockPrismaService.plan.findFirst.mockResolvedValueOnce({
        id: planId,
        workspaceId,
        projectTypeId,
        name: 'Enterprise',
      });
      mockPrismaService.hub.findFirst.mockResolvedValue({
        id: 'hub-1',
        workspaceId,
        projectTypeId,
      });
      mockPrismaService.plan.update.mockResolvedValue({
        id: planId,
        hubId: 'hub-1',
      });

      const result = await service.updatePlanDetails(workspaceId, planId, {
        hubId: 'hub-1',
      });

      expect(prisma.hub.findFirst).toHaveBeenCalledWith({
        where: { id: 'hub-1', workspaceId, projectTypeId },
      });
      expect(prisma.plan.update).toHaveBeenCalledWith({
        where: { id: planId },
        data: { name: undefined, features: undefined, hubId: 'hub-1' },
      });
      expect(result).toEqual({ id: planId, hubId: 'hub-1' });
    });

    it('clears the hub when hubId is explicitly null', async () => {
      mockPrismaService.plan.findFirst.mockResolvedValueOnce({
        id: planId,
        workspaceId,
        projectTypeId,
        name: 'Enterprise',
        hubId: 'hub-1',
      });
      mockPrismaService.plan.update.mockResolvedValue({
        id: planId,
        hubId: null,
      });

      await service.updatePlanDetails(workspaceId, planId, { hubId: null });

      expect(prisma.hub.findFirst).not.toHaveBeenCalled();
      expect(prisma.plan.update).toHaveBeenCalledWith({
        where: { id: planId },
        data: { name: undefined, features: undefined, hubId: null },
      });
    });

    it('throws BadRequestException when the hub is not found in the workspace/project type', async () => {
      mockPrismaService.plan.findFirst.mockResolvedValueOnce({
        id: planId,
        workspaceId,
        projectTypeId,
        name: 'Enterprise',
      });
      mockPrismaService.hub.findFirst.mockResolvedValue(null);

      await expect(
        service.updatePlanDetails(workspaceId, planId, { hubId: 'hub-x' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.plan.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the plan does not belong to the workspace', async () => {
      mockPrismaService.plan.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.updatePlanDetails(workspaceId, planId, { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when renaming to a name already used by another plan', async () => {
      mockPrismaService.plan.findFirst
        .mockResolvedValueOnce({
          id: planId,
          workspaceId,
          projectTypeId,
          name: 'Old Name',
        })
        .mockResolvedValueOnce({ id: 'other-plan', name: 'Taken Name' });

      await expect(
        service.updatePlanDetails(workspaceId, planId, {
          name: 'Taken Name',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateActivePlan', () => {
    it('updates the workspace active plan fields', async () => {
      mockPrismaService.plan.findFirst.mockResolvedValue({
        id: planId,
        workspaceId,
        isActive: true,
      });
      mockPrismaService.plan.update.mockResolvedValue({
        id: planId,
        name: 'Pro',
        isActive: true,
      });

      const dto = { name: 'Pro', isActive: true, features: { a: 1 } };
      const result = await service.updateActivePlan(workspaceId, dto);

      expect(prisma.plan.update).toHaveBeenCalledWith({
        where: { id: planId },
        data: { name: 'Pro', features: { a: 1 }, isActive: true },
      });
      expect(result).toEqual({ id: planId, name: 'Pro', isActive: true });
    });

    it('throws NotFoundException when there is no active plan to update', async () => {
      mockPrismaService.plan.findFirst.mockResolvedValue(null);

      await expect(
        service.updateActivePlan(workspaceId, { name: 'Pro' } as any),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.plan.update).not.toHaveBeenCalled();
    });
  });
});
