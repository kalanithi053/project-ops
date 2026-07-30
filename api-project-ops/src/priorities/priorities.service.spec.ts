import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PrioritiesService } from './priorities.service';

describe('PrioritiesService', () => {
  let service: PrioritiesService;

  const workspaceId = 'ws-1';

  const mockPrismaService = {
    priority: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
    },
    workItem: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrismaService.$transaction.mockImplementation((cb: any) =>
      cb(mockPrismaService),
    );

    const module = await Test.createTestingModule({
      providers: [
        PrioritiesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get(PrioritiesService);
  });

  describe('list', () => {
    it('returns priorities ordered by order asc', async () => {
      const priorities = [{ id: 'p1', workspaceId, name: 'High', order: 0 }];
      mockPrismaService.priority.findMany.mockResolvedValue(priorities);

      const result = await service.list(workspaceId);

      expect(mockPrismaService.priority.findMany).toHaveBeenCalledWith({
        where: { workspaceId },
        orderBy: { order: 'asc' },
      });
      expect(result).toEqual(priorities);
    });
  });

  describe('create', () => {
    it('creates a priority when the name is free', async () => {
      mockPrismaService.priority.findFirst.mockResolvedValue(null);
      const created = {
        id: 'p1',
        workspaceId,
        name: 'High',
        color: '#f59e0b',
        order: 1,
        isDefault: false,
      };
      mockPrismaService.priority.create.mockResolvedValue(created);

      const result = await service.create(workspaceId, {
        name: 'High',
        color: '#f59e0b',
        order: 1,
      });

      expect(mockPrismaService.priority.findFirst).toHaveBeenCalledWith({
        where: { workspaceId, name: 'High' },
      });
      expect(mockPrismaService.priority.create).toHaveBeenCalledWith({
        data: {
          workspaceId,
          name: 'High',
          color: '#f59e0b',
          order: 1,
          isDefault: false,
        },
      });
      expect(mockPrismaService.priority.updateMany).not.toHaveBeenCalled();
      expect(result).toEqual(created);
    });

    it('clears the existing default before creating a new default priority', async () => {
      mockPrismaService.priority.findFirst.mockResolvedValue(null);
      mockPrismaService.priority.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.priority.create.mockResolvedValue({
        id: 'p2',
        workspaceId,
        name: 'Urgent',
        isDefault: true,
      });

      await service.create(workspaceId, { name: 'Urgent', isDefault: true });

      expect(mockPrismaService.priority.updateMany).toHaveBeenCalledWith({
        where: { workspaceId, isDefault: true },
        data: { isDefault: false },
      });
    });

    it('throws ConflictException when a priority with the same name exists', async () => {
      mockPrismaService.priority.findFirst.mockResolvedValue({
        id: 'existing',
        workspaceId,
        name: 'High',
      });

      await expect(
        service.create(workspaceId, { name: 'High' }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.priority.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates a priority in place when found', async () => {
      const existing = {
        id: 'p1',
        workspaceId,
        name: 'High',
        color: '#f59e0b',
        order: 1,
        isDefault: false,
      };
      mockPrismaService.priority.findFirst.mockResolvedValue(existing);
      const updated = { ...existing, color: '#ff0000' };
      mockPrismaService.priority.update.mockResolvedValue(updated);

      const result = await service.update(workspaceId, 'p1', {
        color: '#ff0000',
      });

      expect(mockPrismaService.priority.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: {
          name: undefined,
          color: '#ff0000',
          order: undefined,
          isDefault: undefined,
        },
      });
      expect(result).toEqual(updated);
    });

    it('checks name availability only when the name actually changes', async () => {
      const existing = { id: 'p1', workspaceId, name: 'High' };
      mockPrismaService.priority.findFirst
        .mockResolvedValueOnce(existing) // getOwned
        .mockResolvedValueOnce(null); // assertNameFree
      mockPrismaService.priority.update.mockResolvedValue({
        ...existing,
        name: 'Highest',
      });

      await service.update(workspaceId, 'p1', { name: 'Highest' });

      expect(mockPrismaService.priority.findFirst).toHaveBeenNthCalledWith(2, {
        where: { workspaceId, name: 'Highest' },
      });
    });

    it('throws ConflictException when renaming to an existing name', async () => {
      const existing = { id: 'p1', workspaceId, name: 'High' };
      mockPrismaService.priority.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ id: 'other', workspaceId, name: 'Low' });

      await expect(
        service.update(workspaceId, 'p1', { name: 'Low' }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.priority.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the priority does not exist', async () => {
      mockPrismaService.priority.findFirst.mockResolvedValue(null);

      await expect(
        service.update(workspaceId, 'missing', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes an existing priority', async () => {
      mockPrismaService.priority.findFirst.mockResolvedValue({
        id: 'p1',
        workspaceId,
      });
      mockPrismaService.workItem.count.mockResolvedValue(0);
      mockPrismaService.priority.delete.mockResolvedValue({ id: 'p1' });

      const result = await service.remove(workspaceId, 'p1');

      expect(mockPrismaService.workItem.count).toHaveBeenCalledWith({
        where: { priorityId: 'p1' },
      });
      expect(mockPrismaService.priority.delete).toHaveBeenCalledWith({
        where: { id: 'p1' },
      });
      expect(result).toEqual({ id: 'p1', deleted: true });
    });

    it('throws ConflictException when work items still use the priority', async () => {
      mockPrismaService.priority.findFirst.mockResolvedValue({
        id: 'p1',
        workspaceId,
      });
      mockPrismaService.workItem.count.mockResolvedValue(2);

      await expect(service.remove(workspaceId, 'p1')).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.priority.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the priority does not exist', async () => {
      mockPrismaService.priority.findFirst.mockResolvedValue(null);

      await expect(service.remove(workspaceId, 'missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.priority.delete).not.toHaveBeenCalled();
    });
  });
});
