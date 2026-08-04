import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { TimeLogsService } from './time-logs.service';

describe('TimeLogsService', () => {
  let service: TimeLogsService;
  let activityLog: { log: jest.Mock };

  const workspaceId = 'ws-1';
  const projectId = 'proj-1';
  const workItemId = 'wi-1';
  const userId = 'user-1';
  const otherUserId = 'user-2';

  // Fake transaction client used by $transaction mock — create()/stopTimer()
  // write the entry and its activity log entry atomically.
  const txTimeLog = { create: jest.fn(), update: jest.fn() };

  const mockPrismaService = {
    timeLog: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    workItem: {
      findFirst: jest.fn(),
    },
    workType: {
      findFirst: jest.fn(),
    },
    project: {
      findFirst: jest.fn(),
    },
    workspacePreference: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(async (cb) => cb({ timeLog: txTimeLog })),
  };

  const assignedWorkItem = { id: workItemId, assigneeId: userId };

  beforeEach(async () => {
    jest.clearAllMocks();

    activityLog = { log: jest.fn().mockResolvedValue({ id: 'activity-1' }) };

    const module = await Test.createTestingModule({
      providers: [
        TimeLogsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ActivityLogService, useValue: activityLog },
      ],
    }).compile();

    service = module.get(TimeLogsService);
  });

  describe('create', () => {
    it('creates a manual entry from a bare duration and logs activity', async () => {
      mockPrismaService.workItem.findFirst.mockResolvedValue(assignedWorkItem);
      txTimeLog.create.mockResolvedValue({ id: 'log-1' });

      await service.create(workspaceId, projectId, workItemId, userId, {
        date: '2026-07-30',
        durationMinutes: 30,
        notes: 'Wrote the migration',
      });

      expect(txTimeLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspaceId,
            projectId,
            workItemId,
            userId,
            date: new Date('2026-07-30'),
            startTime: null,
            endTime: null,
            durationMinutes: 30,
            billingType: 'billable',
            source: 'manual',
          }),
        }),
      );
      expect(activityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId,
          projectId,
          entityType: 'task',
          entityId: workItemId,
          action: 'time_logged',
          userId,
          metadata: {
            durationMinutes: 30,
            source: 'manual',
            notes: 'Wrote the migration',
          },
        }),
        expect.anything(),
      );
    });

    it('derives durationMinutes from an explicit start/end pair', async () => {
      mockPrismaService.workItem.findFirst.mockResolvedValue(assignedWorkItem);
      txTimeLog.create.mockResolvedValue({ id: 'log-1' });

      await service.create(workspaceId, projectId, workItemId, userId, {
        date: '2026-07-30',
        startTime: '2026-07-30T09:00:00.000Z',
        endTime: '2026-07-30T09:30:00.000Z',
      });

      expect(txTimeLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ durationMinutes: 30 }),
        }),
      );
    });

    it('throws when only one of startTime/endTime is given', async () => {
      mockPrismaService.workItem.findFirst.mockResolvedValue(assignedWorkItem);

      await expect(
        service.create(workspaceId, projectId, workItemId, userId, {
          date: '2026-07-30',
          startTime: '2026-07-30T09:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when endTime is not after startTime', async () => {
      mockPrismaService.workItem.findFirst.mockResolvedValue(assignedWorkItem);

      await expect(
        service.create(workspaceId, projectId, workItemId, userId, {
          date: '2026-07-30',
          startTime: '2026-07-30T09:30:00.000Z',
          endTime: '2026-07-30T09:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when neither a duration nor a start/end pair is given', async () => {
      mockPrismaService.workItem.findFirst.mockResolvedValue(assignedWorkItem);

      await expect(
        service.create(workspaceId, projectId, workItemId, userId, {
          date: '2026-07-30',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when the caller is not the assignee', async () => {
      mockPrismaService.workItem.findFirst.mockResolvedValue(assignedWorkItem);

      await expect(
        service.create(workspaceId, projectId, workItemId, otherUserId, {
          date: '2026-07-30',
          durationMinutes: 30,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the work item does not exist in the project', async () => {
      mockPrismaService.workItem.findFirst.mockResolvedValue(null);

      await expect(
        service.create(workspaceId, projectId, workItemId, userId, {
          date: '2026-07-30',
          durationMinutes: 30,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('startTimer / stopTimer', () => {
    it('starts a running timer for the assignee', async () => {
      mockPrismaService.workItem.findFirst.mockResolvedValue(assignedWorkItem);
      mockPrismaService.timeLog.findFirst.mockResolvedValue(null);
      mockPrismaService.timeLog.create.mockResolvedValue({ id: 'log-1' });

      await service.startTimer(workspaceId, projectId, workItemId, userId);

      expect(mockPrismaService.timeLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            endTime: null,
            durationMinutes: 0,
            source: 'timer',
          }),
        }),
      );
    });

    it('rejects starting a second timer while one is already running', async () => {
      mockPrismaService.workItem.findFirst.mockResolvedValue(assignedWorkItem);
      mockPrismaService.timeLog.findFirst.mockResolvedValue({
        id: 'running-1',
      });

      await expect(
        service.startTimer(workspaceId, projectId, workItemId, userId),
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.timeLog.create).not.toHaveBeenCalled();
    });

    it('rejects starting a timer when the caller is not the assignee', async () => {
      mockPrismaService.workItem.findFirst.mockResolvedValue(assignedWorkItem);

      await expect(
        service.startTimer(workspaceId, projectId, workItemId, otherUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('stops the running timer, computes durationMinutes, and logs activity', async () => {
      const startTime = new Date(Date.now() - 5 * 60_000);
      const date = new Date('2026-07-30');
      mockPrismaService.workItem.findFirst.mockResolvedValue(assignedWorkItem);
      mockPrismaService.timeLog.findFirst.mockResolvedValue({
        id: 'log-1',
        date,
        startTime,
        notes: null,
      });
      txTimeLog.update.mockResolvedValue({ id: 'log-1' });

      await service.stopTimer(
        workspaceId,
        projectId,
        workItemId,
        userId,
        'Wrapped up the migration',
      );

      const call = txTimeLog.update.mock.calls[0][0];
      expect(call.where).toEqual({ id_date: { id: 'log-1', date } });
      expect(call.data.durationMinutes).toBeGreaterThanOrEqual(4);
      expect(call.data.endTime).toBeInstanceOf(Date);
      expect(call.data.notes).toBe('Wrapped up the migration');

      expect(activityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId,
          projectId,
          entityType: 'task',
          entityId: workItemId,
          action: 'time_logged',
          userId,
          metadata: expect.objectContaining({
            source: 'timer',
            notes: 'Wrapped up the migration',
          }),
        }),
        expect.anything(),
      );
    });

    it('throws NotFoundException when no timer is running', async () => {
      mockPrismaService.workItem.findFirst.mockResolvedValue(assignedWorkItem);
      mockPrismaService.timeLog.findFirst.mockResolvedValue(null);

      await expect(
        service.stopTimer(workspaceId, projectId, workItemId, userId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMyRunningTimer', () => {
    it('returns null when the caller has no running timer', async () => {
      mockPrismaService.timeLog.findFirst.mockResolvedValue(null);

      await expect(service.getMyRunningTimer(userId)).resolves.toBeNull();
    });

    it('flattens the work item + workspace slug onto the entry', async () => {
      mockPrismaService.timeLog.findFirst.mockResolvedValue({
        id: 'log-1',
        userId,
        workItemId,
        workItem: { id: workItemId, name: 'Custom Properties', prefix: 'CP-3' },
        project: { workspace: { slug: 'acme' } },
      });

      const result = await service.getMyRunningTimer(userId);

      expect(result).toEqual({
        id: 'log-1',
        userId,
        workItemId,
        workItem: { id: workItemId, name: 'Custom Properties', prefix: 'CP-3' },
        workspaceSlug: 'acme',
      });
    });
  });

  describe('listForProject', () => {
    it('builds a date-range + user filter', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({ id: projectId });
      mockPrismaService.timeLog.findMany.mockResolvedValue([]);

      await service.listForProject(workspaceId, projectId, {
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        userId,
      });

      expect(mockPrismaService.timeLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            projectId,
            NOT: { source: 'timer', endTime: null },
            userId,
            date: {
              gte: new Date('2026-07-01'),
              lte: new Date('2026-07-31'),
            },
          },
        }),
      );
    });

    it('omits the date filter entirely when no dates are given', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({ id: projectId });
      mockPrismaService.timeLog.findMany.mockResolvedValue([]);

      await service.listForProject(workspaceId, projectId, {});

      expect(mockPrismaService.timeLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId, NOT: { source: 'timer', endTime: null } },
        }),
      );
    });
  });

  describe('update / remove', () => {
    it('recomputes durationMinutes when start/end change', async () => {
      const date = new Date('2026-07-30');
      mockPrismaService.timeLog.findFirst.mockResolvedValue({
        id: 'log-1',
        userId,
        date,
        startTime: new Date('2026-07-30T09:00:00.000Z'),
        endTime: new Date('2026-07-30T09:30:00.000Z'),
        durationMinutes: 30,
      });
      mockPrismaService.timeLog.update.mockResolvedValue({ id: 'log-1' });

      await service.update('log-1', userId, {
        endTime: '2026-07-30T10:00:00.000Z',
      });

      expect(mockPrismaService.timeLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id_date: { id: 'log-1', date } },
          data: expect.objectContaining({ durationMinutes: 60 }),
        }),
      );
    });

    it("throws NotFoundException editing an entry that is not the caller's own", async () => {
      mockPrismaService.timeLog.findFirst.mockResolvedValue(null);

      await expect(
        service.update('log-1', otherUserId, { notes: 'nope' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.timeLog.update).not.toHaveBeenCalled();
    });

    it("deletes only the caller's own entry", async () => {
      const date = new Date('2026-07-30');
      mockPrismaService.timeLog.findFirst.mockResolvedValue({
        id: 'log-1',
        userId,
        date,
      });
      mockPrismaService.timeLog.delete.mockResolvedValue({ id: 'log-1' });

      const result = await service.remove('log-1', userId);

      expect(mockPrismaService.timeLog.delete).toHaveBeenCalledWith({
        where: { id_date: { id: 'log-1', date } },
      });
      expect(result).toEqual({ id: 'log-1', deleted: true });
    });
  });
});
