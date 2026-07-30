import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { WorkTypesService } from './work-types.service';

describe('WorkTypesService', () => {
  let service: WorkTypesService;

  const workspaceId = 'ws-1';

  const mockPrismaService = {
    workType: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        WorkTypesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get(WorkTypesService);
  });

  describe('list', () => {
    it('returns work types ordered by name asc', async () => {
      const workTypes = [
        { id: 'wt1', workspaceId, name: 'Bug', category: 'bug' },
      ];
      mockPrismaService.workType.findMany.mockResolvedValue(workTypes);

      const result = await service.list(workspaceId);

      expect(mockPrismaService.workType.findMany).toHaveBeenCalledWith({
        where: { workspaceId },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(workTypes);
    });
  });

  describe('findOne', () => {
    it('returns the work type when found', async () => {
      const workType = { id: 'wt1', workspaceId, name: 'Bug', category: 'bug' };
      mockPrismaService.workType.findFirst.mockResolvedValue(workType);

      const result = await service.findOne(workspaceId, 'wt1');

      expect(mockPrismaService.workType.findFirst).toHaveBeenCalledWith({
        where: { id: 'wt1', workspaceId },
      });
      expect(result).toEqual(workType);
    });

    it('throws NotFoundException when the work type does not exist', async () => {
      mockPrismaService.workType.findFirst.mockResolvedValue(null);

      await expect(service.findOne(workspaceId, 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates a work type when the name is free', async () => {
      mockPrismaService.workType.findFirst.mockResolvedValue(null);
      const created = {
        id: 'wt1',
        workspaceId,
        name: 'Bug',
        color: '#e4f468ff',
        category: 'bug',
        isActive: true,
      };
      mockPrismaService.workType.create.mockResolvedValue(created);

      const result = await service.create(workspaceId, {
        name: 'Bug',
        color: '#e4f468ff',
        category: 'bug',
      });

      expect(mockPrismaService.workType.findFirst).toHaveBeenCalledWith({
        where: { workspaceId, name: 'Bug' },
      });
      expect(mockPrismaService.workType.create).toHaveBeenCalledWith({
        data: {
          workspaceId,
          name: 'Bug',
          color: '#e4f468ff',
          category: 'bug',
          isActive: true,
        },
      });
      expect(result).toEqual(created);
    });

    it('defaults isActive to false when explicitly requested', async () => {
      mockPrismaService.workType.findFirst.mockResolvedValue(null);
      mockPrismaService.workType.create.mockResolvedValue({
        id: 'wt2',
        workspaceId,
        name: 'Incident',
        category: 'incident',
        isActive: false,
      });

      await service.create(workspaceId, {
        name: 'Incident',
        category: 'incident',
        isActive: false,
      });

      expect(mockPrismaService.workType.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isActive: false }),
      });
    });

    it('throws ConflictException when a work type with the same name exists', async () => {
      mockPrismaService.workType.findFirst.mockResolvedValue({
        id: 'existing',
        workspaceId,
        name: 'Bug',
      });

      await expect(
        service.create(workspaceId, { name: 'Bug', category: 'bug' as any }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.workType.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates a work type in place when found', async () => {
      const existing = {
        id: 'wt1',
        workspaceId,
        name: 'Bug',
        color: '#fff',
        category: 'bug',
        isActive: true,
      };
      mockPrismaService.workType.findFirst.mockResolvedValue(existing);
      const updated = { ...existing, color: '#000' };
      mockPrismaService.workType.update.mockResolvedValue(updated);

      const result = await service.update(workspaceId, 'wt1', {
        color: '#000',
      });

      expect(mockPrismaService.workType.update).toHaveBeenCalledWith({
        where: { id: 'wt1' },
        data: {
          name: undefined,
          color: '#000',
          category: undefined,
          isActive: undefined,
        },
      });
      expect(result).toEqual(updated);
    });

    it('checks name availability only when the name actually changes', async () => {
      const existing = { id: 'wt1', workspaceId, name: 'Bug', category: 'bug' };
      mockPrismaService.workType.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(null);
      mockPrismaService.workType.update.mockResolvedValue({
        ...existing,
        name: 'Defect',
      });

      await service.update(workspaceId, 'wt1', { name: 'Defect' });

      expect(mockPrismaService.workType.findFirst).toHaveBeenNthCalledWith(2, {
        where: { workspaceId, name: 'Defect' },
      });
    });

    it('skips the name-free check when the name is unchanged', async () => {
      const existing = { id: 'wt1', workspaceId, name: 'Bug', category: 'bug' };
      mockPrismaService.workType.findFirst.mockResolvedValueOnce(existing);
      mockPrismaService.workType.update.mockResolvedValue(existing);

      await service.update(workspaceId, 'wt1', { name: 'Bug' });

      expect(mockPrismaService.workType.findFirst).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException when renaming to an existing name', async () => {
      const existing = { id: 'wt1', workspaceId, name: 'Bug' };
      mockPrismaService.workType.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ id: 'other', workspaceId, name: 'Defect' });

      await expect(
        service.update(workspaceId, 'wt1', { name: 'Defect' }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.workType.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the work type does not exist', async () => {
      mockPrismaService.workType.findFirst.mockResolvedValue(null);

      await expect(
        service.update(workspaceId, 'missing', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes an existing work type', async () => {
      mockPrismaService.workType.findFirst.mockResolvedValue({
        id: 'wt1',
        workspaceId,
      });
      mockPrismaService.workType.delete.mockResolvedValue({ id: 'wt1' });

      const result = await service.remove(workspaceId, 'wt1');

      expect(mockPrismaService.workType.delete).toHaveBeenCalledWith({
        where: { id: 'wt1' },
      });
      expect(result).toEqual({ id: 'wt1', deleted: true });
    });

    it('throws NotFoundException when the work type does not exist', async () => {
      mockPrismaService.workType.findFirst.mockResolvedValue(null);

      await expect(service.remove(workspaceId, 'missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.workType.delete).not.toHaveBeenCalled();
    });
  });
});
