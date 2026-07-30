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
