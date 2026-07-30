import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ModuleInstancesService } from './module-instances.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttachModuleDto } from './dto/attach-module.dto';
import { UpdateModuleInstanceDto } from './dto/update-module-instance.dto';

describe('ModuleInstancesService', () => {
  let service: ModuleInstancesService;
  let prisma: {
    project: { findFirst: jest.Mock };
    module: { findFirst: jest.Mock };
    moduleInstance: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const workspaceId = 'ws-1';
  const projectId = 'proj-1';

  beforeEach(async () => {
    prisma = {
      project: { findFirst: jest.fn() },
      module: { findFirst: jest.fn() },
      moduleInstance: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModuleInstancesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ModuleInstancesService>(ModuleInstancesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const project = { id: projectId, workspaceId, deletedAt: null };

  describe('list', () => {
    it('returns the project module instances on the happy path', async () => {
      prisma.project.findFirst.mockResolvedValue(project);
      const instances = [
        {
          id: 'mi-1',
          projectId,
          moduleId: 'mod-1',
          taskLimit: 10,
          addonTask: 0,
          module: { key: 'pipeline', name: 'Pipeline' },
        },
      ];
      prisma.moduleInstance.findMany.mockResolvedValue(instances);

      const result = await service.list(workspaceId, projectId);

      expect(result).toEqual(instances);
      expect(prisma.moduleInstance.findMany).toHaveBeenCalledWith({
        where: { projectId },
        include: { module: { select: { key: true, name: true } } },
      });
    });

    it('throws NotFoundException when the project does not exist in the workspace', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.list(workspaceId, projectId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.moduleInstance.findMany).not.toHaveBeenCalled();
    });
  });

  describe('attach', () => {
    const dto: AttachModuleDto = { moduleId: 'mod-1' };
    const catalogModule = {
      id: 'mod-1',
      workspaceId,
      defaultTaskLimit: 10,
    };

    it('attaches a module to the project on the happy path', async () => {
      prisma.project.findFirst.mockResolvedValue(project);
      prisma.module.findFirst.mockResolvedValue(catalogModule);
      prisma.moduleInstance.findFirst.mockResolvedValue(null);
      const created = {
        id: 'mi-1',
        projectId,
        moduleId: dto.moduleId,
        taskLimit: 10,
      };
      prisma.moduleInstance.create.mockResolvedValue(created);

      const result = await service.attach(workspaceId, projectId, dto);

      expect(result).toEqual(created);
      expect(prisma.moduleInstance.create).toHaveBeenCalledWith({
        data: { projectId, moduleId: dto.moduleId, taskLimit: 10 },
      });
    });

    it('uses the dto taskLimit override instead of the module default', async () => {
      prisma.project.findFirst.mockResolvedValue(project);
      prisma.module.findFirst.mockResolvedValue(catalogModule);
      prisma.moduleInstance.findFirst.mockResolvedValue(null);
      prisma.moduleInstance.create.mockResolvedValue({});

      await service.attach(workspaceId, projectId, { ...dto, taskLimit: 3 });

      expect(prisma.moduleInstance.create).toHaveBeenCalledWith({
        data: { projectId, moduleId: dto.moduleId, taskLimit: 3 },
      });
    });

    it('throws NotFoundException when the project does not exist in the workspace', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.attach(workspaceId, projectId, dto),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.moduleInstance.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the module does not exist in the workspace', async () => {
      prisma.project.findFirst.mockResolvedValue(project);
      prisma.module.findFirst.mockResolvedValue(null);

      await expect(
        service.attach(workspaceId, projectId, dto),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.moduleInstance.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the module is already attached to the project', async () => {
      prisma.project.findFirst.mockResolvedValue(project);
      prisma.module.findFirst.mockResolvedValue(catalogModule);
      prisma.moduleInstance.findFirst.mockResolvedValue({
        id: 'existing',
        projectId,
        moduleId: dto.moduleId,
      });

      await expect(
        service.attach(workspaceId, projectId, dto),
      ).rejects.toThrow(ConflictException);
      expect(prisma.moduleInstance.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const instanceId = 'mi-1';
    const dto: UpdateModuleInstanceDto = { taskLimit: 20 };
    const instance = { id: instanceId, projectId, moduleId: 'mod-1', taskLimit: 10 };

    it('updates the task limit on the happy path', async () => {
      prisma.project.findFirst.mockResolvedValue(project);
      prisma.moduleInstance.findFirst.mockResolvedValue(instance);
      const updated = { ...instance, taskLimit: dto.taskLimit };
      prisma.moduleInstance.update.mockResolvedValue(updated);

      const result = await service.update(
        workspaceId,
        projectId,
        instanceId,
        dto,
      );

      expect(result).toEqual(updated);
      expect(prisma.moduleInstance.update).toHaveBeenCalledWith({
        where: { id: instanceId },
        data: { taskLimit: dto.taskLimit },
      });
    });

    it('throws NotFoundException when the project does not exist in the workspace', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.update(workspaceId, projectId, instanceId, dto),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.moduleInstance.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the module instance does not belong to the project', async () => {
      prisma.project.findFirst.mockResolvedValue(project);
      prisma.moduleInstance.findFirst.mockResolvedValue(null);

      await expect(
        service.update(workspaceId, projectId, instanceId, dto),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.moduleInstance.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    const instanceId = 'mi-1';
    const instance = { id: instanceId, projectId, moduleId: 'mod-1', taskLimit: 10 };

    it('deletes the module instance on the happy path', async () => {
      prisma.project.findFirst.mockResolvedValue(project);
      prisma.moduleInstance.findFirst.mockResolvedValue(instance);
      prisma.moduleInstance.delete.mockResolvedValue(instance);

      const result = await service.remove(workspaceId, projectId, instanceId);

      expect(result).toEqual({ id: instanceId, deleted: true });
      expect(prisma.moduleInstance.delete).toHaveBeenCalledWith({
        where: { id: instanceId },
      });
    });

    it('throws NotFoundException when the project does not exist in the workspace', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(workspaceId, projectId, instanceId),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.moduleInstance.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the module instance does not belong to the project', async () => {
      prisma.project.findFirst.mockResolvedValue(project);
      prisma.moduleInstance.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(workspaceId, projectId, instanceId),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.moduleInstance.delete).not.toHaveBeenCalled();
    });
  });
});
