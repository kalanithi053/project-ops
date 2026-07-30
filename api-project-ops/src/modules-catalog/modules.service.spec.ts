import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ModulesService } from './modules.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';

describe('ModulesService', () => {
  let service: ModulesService;
  let prisma: {
    module: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
    plan: { findFirst: jest.Mock };
    moduleInstance: { count: jest.Mock };
  };

  const workspaceId = 'ws-1';

  beforeEach(async () => {
    prisma = {
      module: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      plan: { findFirst: jest.fn() },
      moduleInstance: { count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ModulesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ModulesService>(ModulesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('throws BadRequestException when no planId is provided', () => {
      expect(() => service.list(workspaceId, undefined)).toThrow(
        BadRequestException,
      );
      expect(prisma.module.findMany).not.toHaveBeenCalled();
    });

    it('returns modules scoped to workspace + plan on the happy path', async () => {
      const planId = 'plan-1';
      const modules = [
        {
          id: 'mod-1',
          workspaceId,
          planId,
          key: 'pipeline',
          name: 'Pipeline',
          defaultTaskLimit: 10,
          isDefault: false,
          isActive: true,
        },
      ];
      prisma.module.findMany.mockResolvedValue(modules);

      const result = await service.list(workspaceId, planId);

      expect(result).toEqual(modules);
      expect(prisma.module.findMany).toHaveBeenCalledWith({
        where: { workspaceId, planId },
        orderBy: [{ planId: 'asc' }, { name: 'asc' }],
        include: { plan: { select: { id: true, name: true } } },
      });
    });
  });

  describe('create', () => {
    const dto: CreateModuleDto = {
      planId: 'plan-1',
      key: 'pipeline',
      name: 'Pipeline',
    };

    it('creates a module on the happy path', async () => {
      prisma.plan.findFirst.mockResolvedValue({
        id: dto.planId,
        workspaceId,
      });
      prisma.module.findFirst.mockResolvedValue(null);
      const created = {
        id: 'mod-1',
        workspaceId,
        planId: dto.planId,
        key: dto.key,
        name: dto.name,
        defaultTaskLimit: 10,
        isDefault: false,
        isActive: true,
      };
      prisma.module.create.mockResolvedValue(created);

      const result = await service.create(workspaceId, dto);

      expect(result).toEqual(created);
      expect(prisma.module.create).toHaveBeenCalledWith({
        data: {
          workspaceId,
          planId: dto.planId,
          key: dto.key,
          name: dto.name,
          defaultTaskLimit: 10,
          isDefault: false,
          isActive: true,
        },
      });
    });

    it('respects explicit defaultTaskLimit/isDefault/isActive overrides', async () => {
      prisma.plan.findFirst.mockResolvedValue({ id: dto.planId, workspaceId });
      prisma.module.findFirst.mockResolvedValue(null);
      prisma.module.create.mockResolvedValue({});

      await service.create(workspaceId, {
        ...dto,
        defaultTaskLimit: 5,
        isDefault: true,
        isActive: false,
      });

      expect(prisma.module.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          defaultTaskLimit: 5,
          isDefault: true,
          isActive: false,
        }),
      });
    });

    it('throws BadRequestException when the plan is not found in the workspace', async () => {
      prisma.plan.findFirst.mockResolvedValue(null);

      await expect(service.create(workspaceId, dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.module.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when a module with the same key already exists in the plan', async () => {
      prisma.plan.findFirst.mockResolvedValue({ id: dto.planId, workspaceId });
      prisma.module.findFirst.mockResolvedValue({
        id: 'existing',
        planId: dto.planId,
        key: dto.key,
      });

      await expect(service.create(workspaceId, dto)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.module.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const id = 'mod-1';
    const dto: UpdateModuleDto = { name: 'New name' };

    it('updates a module on the happy path', async () => {
      prisma.module.findFirst.mockResolvedValue({ id, workspaceId });
      const updated = { id, name: dto.name };
      prisma.module.update.mockResolvedValue(updated);

      const result = await service.update(workspaceId, id, dto);

      expect(result).toEqual(updated);
      expect(prisma.module.update).toHaveBeenCalledWith({
        where: { id },
        data: {
          name: dto.name,
          defaultTaskLimit: undefined,
          isDefault: undefined,
          isActive: undefined,
        },
      });
    });

    it('throws NotFoundException when the module does not belong to the workspace', async () => {
      prisma.module.findFirst.mockResolvedValue(null);

      await expect(service.update(workspaceId, id, dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.module.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    const id = 'mod-1';

    it('deletes a module on the happy path when it has no instances', async () => {
      prisma.module.findFirst.mockResolvedValue({ id, workspaceId });
      prisma.moduleInstance.count.mockResolvedValue(0);
      prisma.module.delete.mockResolvedValue({ id });

      const result = await service.remove(workspaceId, id);

      expect(result).toEqual({ id, deleted: true });
      expect(prisma.module.delete).toHaveBeenCalledWith({ where: { id } });
    });

    it('throws NotFoundException when the module does not belong to the workspace', async () => {
      prisma.module.findFirst.mockResolvedValue(null);

      await expect(service.remove(workspaceId, id)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.module.delete).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the module is attached to project(s)', async () => {
      prisma.module.findFirst.mockResolvedValue({ id, workspaceId });
      prisma.moduleInstance.count.mockResolvedValue(2);

      await expect(service.remove(workspaceId, id)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.module.delete).not.toHaveBeenCalled();
    });
  });
});
