import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatusService } from './ticket-status.service';

describe('TicketStatusService', () => {
  let service: TicketStatusService;

  const workspaceId = 'ws-1';

  const mockPrismaService = {
    ticketStatus: {
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
        TicketStatusService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get(TicketStatusService);
  });

  describe('list', () => {
    it('returns statuses ordered by order asc', async () => {
      const statuses = [
        { id: 's1', workspaceId, name: 'Todo', order: 0, category: 'todo' },
      ];
      mockPrismaService.ticketStatus.findMany.mockResolvedValue(statuses);

      const result = await service.list(workspaceId);

      expect(mockPrismaService.ticketStatus.findMany).toHaveBeenCalledWith({
        where: { workspaceId },
        orderBy: { order: 'asc' },
      });
      expect(result).toEqual(statuses);
    });
  });

  describe('create', () => {
    it('creates a status when the name is free', async () => {
      mockPrismaService.ticketStatus.findFirst.mockResolvedValue(null);
      const created = {
        id: 's1',
        workspaceId,
        name: 'In Review',
        color: '#f59e0b',
        order: 0,
        category: 'review',
        isDefault: false,
        canDelete: true,
      };
      mockPrismaService.ticketStatus.create.mockResolvedValue(created);

      const result = await service.create(workspaceId, {
        name: 'In Review',
        color: '#f59e0b',
        category: 'review' as any,
      });

      expect(mockPrismaService.ticketStatus.findFirst).toHaveBeenCalledWith({
        where: { workspaceId, name: 'In Review' },
      });
      expect(mockPrismaService.ticketStatus.create).toHaveBeenCalledWith({
        data: {
          workspaceId,
          name: 'In Review',
          color: '#f59e0b',
          order: 0,
          category: 'review',
          isDefault: false,
          canDelete: true,
        },
      });
      expect(result).toEqual(created);
    });

    it('clears the existing default before creating a new default status', async () => {
      mockPrismaService.ticketStatus.findFirst.mockResolvedValue(null);
      mockPrismaService.ticketStatus.create.mockResolvedValue({
        id: 's2',
        workspaceId,
        name: 'Done',
        category: 'done',
        isDefault: true,
      });

      await service.create(workspaceId, {
        name: 'Done',
        category: 'done' as any,
        isDefault: true,
      });

      expect(mockPrismaService.ticketStatus.updateMany).toHaveBeenCalledWith({
        where: { workspaceId, isDefault: true },
        data: { isDefault: false },
      });
    });

    it('forces canDelete=false for a status literally named "removed" (case-insensitive), even if canDelete=true was requested', async () => {
      mockPrismaService.ticketStatus.findFirst.mockResolvedValue(null);
      mockPrismaService.ticketStatus.create.mockResolvedValue({
        id: 's3',
        workspaceId,
        name: 'Removed',
        category: 'removed',
        canDelete: false,
      });

      await service.create(workspaceId, {
        name: 'Removed',
        category: 'removed' as any,
        canDelete: true,
      });

      expect(mockPrismaService.ticketStatus.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ canDelete: false }),
      });
    });

    it('throws ConflictException when a status with the same name exists', async () => {
      mockPrismaService.ticketStatus.findFirst.mockResolvedValue({
        id: 'existing',
        workspaceId,
        name: 'Todo',
      });

      await expect(
        service.create(workspaceId, { name: 'Todo', category: 'todo' as any }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.ticketStatus.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates a status in place when found', async () => {
      const existing = {
        id: 's1',
        workspaceId,
        name: 'Todo',
        color: '#fff',
        order: 0,
        category: 'todo',
        isDefault: false,
        canDelete: true,
      };
      mockPrismaService.ticketStatus.findFirst.mockResolvedValue(existing);
      const updated = { ...existing, color: '#000' };
      mockPrismaService.ticketStatus.update.mockResolvedValue(updated);

      const result = await service.update(workspaceId, 's1', {
        color: '#000',
      });

      expect(mockPrismaService.ticketStatus.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: {
          name: undefined,
          color: '#000',
          order: undefined,
          category: undefined,
          isDefault: undefined,
          canDelete: undefined,
        },
      });
      expect(result).toEqual(updated);
    });

    it('checks name availability only when the name actually changes', async () => {
      const existing = {
        id: 's1',
        workspaceId,
        name: 'Todo',
        category: 'todo',
      };
      mockPrismaService.ticketStatus.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(null);
      mockPrismaService.ticketStatus.update.mockResolvedValue({
        ...existing,
        name: 'Doing',
      });

      await service.update(workspaceId, 's1', { name: 'Doing' });

      expect(mockPrismaService.ticketStatus.findFirst).toHaveBeenNthCalledWith(
        2,
        { where: { workspaceId, name: 'Doing' } },
      );
    });

    it('forces canDelete=false when renaming a status to "removed"', async () => {
      const existing = {
        id: 's1',
        workspaceId,
        name: 'Archive',
        category: 'done',
        canDelete: true,
      };
      mockPrismaService.ticketStatus.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(null);
      mockPrismaService.ticketStatus.update.mockResolvedValue({
        ...existing,
        name: 'removed',
        canDelete: false,
      });

      await service.update(workspaceId, 's1', {
        name: 'removed',
        canDelete: true,
      });

      expect(mockPrismaService.ticketStatus.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: expect.objectContaining({ canDelete: false }),
      });
    });

    it('throws ConflictException when renaming to an existing name', async () => {
      const existing = { id: 's1', workspaceId, name: 'Todo' };
      mockPrismaService.ticketStatus.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ id: 'other', workspaceId, name: 'Doing' });

      await expect(
        service.update(workspaceId, 's1', { name: 'Doing' }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.ticketStatus.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the status does not exist', async () => {
      mockPrismaService.ticketStatus.findFirst.mockResolvedValue(null);

      await expect(
        service.update(workspaceId, 'missing', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes an existing deletable status', async () => {
      mockPrismaService.ticketStatus.findFirst.mockResolvedValue({
        id: 's1',
        workspaceId,
        canDelete: true,
      });
      mockPrismaService.workItem.count.mockResolvedValue(0);
      mockPrismaService.ticketStatus.delete.mockResolvedValue({ id: 's1' });

      const result = await service.remove(workspaceId, 's1');

      expect(mockPrismaService.workItem.count).toHaveBeenCalledWith({
        where: { statusId: 's1' },
      });
      expect(mockPrismaService.ticketStatus.delete).toHaveBeenCalledWith({
        where: { id: 's1' },
      });
      expect(result).toEqual({ id: 's1', deleted: true });
    });

    it('throws ConflictException when the status is not deletable', async () => {
      mockPrismaService.ticketStatus.findFirst.mockResolvedValue({
        id: 's1',
        workspaceId,
        canDelete: false,
      });

      await expect(service.remove(workspaceId, 's1')).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.ticketStatus.delete).not.toHaveBeenCalled();
    });

    it('throws ConflictException when work items still use the status', async () => {
      mockPrismaService.ticketStatus.findFirst.mockResolvedValue({
        id: 's1',
        workspaceId,
        canDelete: true,
      });
      mockPrismaService.workItem.count.mockResolvedValue(3);

      await expect(service.remove(workspaceId, 's1')).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.ticketStatus.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the status does not exist', async () => {
      mockPrismaService.ticketStatus.findFirst.mockResolvedValue(null);

      await expect(service.remove(workspaceId, 'missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.ticketStatus.delete).not.toHaveBeenCalled();
    });
  });
});
