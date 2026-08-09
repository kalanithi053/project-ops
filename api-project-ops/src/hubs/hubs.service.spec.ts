import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { HubsService } from './hubs.service';
import { PrismaService } from '../prisma/prisma.service';
import { HUB_TIERS } from '../common/constants/workspace-defaults';

describe('HubsService', () => {
  let service: HubsService;
  let prisma: any;

  const workspaceId = 'ws-1';
  const projectTypeId = 'pt-1';
  const hubId = 'hub-1';

  const mockPrismaService = {
    projectType: {
      findFirst: jest.fn(),
    },
    hub: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    plan: {
      createMany: jest.fn(),
    },
    project: {
      count: jest.fn(),
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
        HubsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<HubsService>(HubsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('listHubs', () => {
    it('lists hubs for a project type in the workspace', async () => {
      const hubs = [{ id: hubId, workspaceId, projectTypeId }];
      mockPrismaService.hub.findMany.mockResolvedValue(hubs);

      const result = await service.listHubs(workspaceId, projectTypeId);

      expect(prisma.hub.findMany).toHaveBeenCalledWith({
        where: { workspaceId, projectTypeId },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(hubs);
    });

    it('throws BadRequestException when projectTypeId is missing', async () => {
      await expect(service.listHubs(workspaceId, undefined)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.hub.findMany).not.toHaveBeenCalled();
    });
  });

  describe('createHub', () => {
    it('creates a hub and seeds its tier plans', async () => {
      mockPrismaService.projectType.findFirst.mockResolvedValue({
        id: projectTypeId,
        workspaceId,
      });
      mockPrismaService.hub.findFirst.mockResolvedValue(null); // name free
      mockPrismaService.hub.create.mockResolvedValue({
        id: hubId,
        workspaceId,
        projectTypeId,
        name: 'Marketing Hub',
        color: '#fff',
        isActive: true,
      });
      mockPrismaService.plan.createMany.mockResolvedValue({
        count: HUB_TIERS.length,
      });

      const dto = { projectTypeId, name: 'Marketing Hub', color: '#fff' };
      const result = await service.createHub(workspaceId, dto);

      expect(prisma.projectType.findFirst).toHaveBeenCalledWith({
        where: { id: projectTypeId, workspaceId },
      });
      expect(prisma.hub.findFirst).toHaveBeenCalledWith({
        where: { projectTypeId, name: 'Marketing Hub' },
      });
      expect(prisma.hub.create).toHaveBeenCalledWith({
        data: {
          workspaceId,
          projectTypeId,
          name: 'Marketing Hub',
          color: '#fff',
          isActive: true,
        },
      });
      expect(prisma.plan.createMany).toHaveBeenCalledWith({
        data: HUB_TIERS.map((tier) => ({
          workspaceId,
          projectTypeId,
          hubId,
          name: tier,
          isActive: false,
        })),
      });
      expect(result).toEqual({
        id: hubId,
        workspaceId,
        projectTypeId,
        name: 'Marketing Hub',
        color: '#fff',
        isActive: true,
      });
    });

    it('throws BadRequestException when the project type is not in the workspace', async () => {
      mockPrismaService.projectType.findFirst.mockResolvedValue(null);

      await expect(
        service.createHub(workspaceId, {
          projectTypeId,
          name: 'Marketing Hub',
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.hub.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when a hub with that name already exists for the project type', async () => {
      mockPrismaService.projectType.findFirst.mockResolvedValue({
        id: projectTypeId,
        workspaceId,
      });
      mockPrismaService.hub.findFirst.mockResolvedValue({
        id: 'other-hub',
        name: 'Marketing Hub',
      });

      await expect(
        service.createHub(workspaceId, {
          projectTypeId,
          name: 'Marketing Hub',
        } as any),
      ).rejects.toThrow(ConflictException);
      expect(prisma.hub.create).not.toHaveBeenCalled();
    });
  });

  describe('updateHub', () => {
    it('updates a hub name and fields', async () => {
      mockPrismaService.hub.findFirst
        .mockResolvedValueOnce({
          id: hubId,
          workspaceId,
          projectTypeId,
          name: 'Old Name',
        }) // getOwned
        .mockResolvedValueOnce(null); // assertNameFree
      mockPrismaService.hub.update.mockResolvedValue({
        id: hubId,
        name: 'New Name',
      });

      const result = await service.updateHub(workspaceId, hubId, {
        name: 'New Name',
      });

      expect(prisma.hub.update).toHaveBeenCalledWith({
        where: { id: hubId },
        data: { name: 'New Name', color: undefined, isActive: undefined },
      });
      expect(result).toEqual({ id: hubId, name: 'New Name' });
    });

    it('skips the name-uniqueness check when the name is unchanged', async () => {
      mockPrismaService.hub.findFirst.mockResolvedValueOnce({
        id: hubId,
        workspaceId,
        projectTypeId,
        name: 'Same Name',
      });
      mockPrismaService.hub.update.mockResolvedValue({
        id: hubId,
        name: 'Same Name',
      });

      await service.updateHub(workspaceId, hubId, { name: 'Same Name' });

      expect(prisma.hub.findFirst).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException when the hub does not belong to the workspace', async () => {
      mockPrismaService.hub.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.updateHub(workspaceId, hubId, { name: 'New Name' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when renaming to a name already used by another hub', async () => {
      mockPrismaService.hub.findFirst
        .mockResolvedValueOnce({
          id: hubId,
          workspaceId,
          projectTypeId,
          name: 'Old Name',
        })
        .mockResolvedValueOnce({ id: 'other-hub', name: 'Taken Name' });

      await expect(
        service.updateHub(workspaceId, hubId, {
          name: 'Taken Name',
        } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('deleteHub', () => {
    it('deletes a hub that is not in use', async () => {
      mockPrismaService.hub.findFirst.mockResolvedValue({
        id: hubId,
        workspaceId,
      });
      mockPrismaService.project.count.mockResolvedValue(0);
      mockPrismaService.hub.delete.mockResolvedValue({ id: hubId });

      const result = await service.deleteHub(workspaceId, hubId);

      expect(prisma.project.count).toHaveBeenCalledWith({
        where: { hubId: { has: hubId }, deletedAt: null },
      });
      expect(prisma.hub.delete).toHaveBeenCalledWith({ where: { id: hubId } });
      expect(result).toEqual({ id: hubId, deleted: true });
    });

    it('throws NotFoundException when the hub does not belong to the workspace', async () => {
      mockPrismaService.hub.findFirst.mockResolvedValue(null);

      await expect(service.deleteHub(workspaceId, hubId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.hub.delete).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the hub is in use by active projects', async () => {
      mockPrismaService.hub.findFirst.mockResolvedValue({
        id: hubId,
        workspaceId,
      });
      mockPrismaService.project.count.mockResolvedValue(2);

      await expect(service.deleteHub(workspaceId, hubId)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.hub.delete).not.toHaveBeenCalled();
    });
  });
});
