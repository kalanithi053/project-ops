import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: {
    project: { findFirst: jest.Mock };
    moduleInstance: { findMany: jest.Mock };
    workItem: { findMany: jest.Mock };
    projectMember: { findMany: jest.Mock };
    ticketStatus: { findMany: jest.Mock };
    timeLog: { groupBy: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      project: { findFirst: jest.fn() },
      moduleInstance: { findMany: jest.fn() },
      workItem: { findMany: jest.fn() },
      projectMember: { findMany: jest.fn() },
      ticketStatus: { findMany: jest.fn() },
      timeLog: { groupBy: jest.fn() },
    };
    // Defaults to no logged time so existing assertions on `user` workload
    // don't need to know about time logs unless a test cares about them.
    prisma.timeLog.groupBy.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ReportsService);
  });

  describe('getProjectReport()', () => {
    const workspaceId = 'ws-1';
    const projectId = 'proj-1';

    it('throws NotFoundException when the project does not exist (or is deleted / wrong workspace)', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getProjectReport(workspaceId, projectId),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.project.findFirst).toHaveBeenCalledWith({
        where: { id: projectId, workspaceId, deletedAt: null },
      });
      expect(prisma.workItem.findMany).not.toHaveBeenCalled();
    });

    it('builds byType, statusBreakdown, progress, byPriority, user and modules from work items', async () => {
      prisma.project.findFirst.mockResolvedValue({
        id: projectId,
        workspaceId,
      });

      prisma.moduleInstance.findMany.mockResolvedValue([
        {
          id: 'mi-1',
          taskLimit: 10,
          addonTask: 2,
          module: { name: 'Sprint Board' },
        },
      ]);

      const taskType = {
        id: 'wt-task',
        name: 'Task',
        category: 'task',
        color: '#3b82f6',
      };
      const bugType = {
        id: 'wt-bug',
        name: 'Bug',
        category: 'bug',
        color: '#ef4444',
      };
      const todoStatus = { name: 'To Do', category: 'todo', isDefault: true };
      const doneStatus = { name: 'Done', category: 'done', isDefault: false };
      const highPriority = { name: 'High' };
      const lowPriority = { name: 'Low' };

      prisma.workItem.findMany.mockResolvedValue([
        {
          moduleInstanceId: 'mi-1',
          assigneeId: 'user-1',
          workItemType: taskType,
          status: doneStatus,
          priority: highPriority,
          estimateHours: 5,
          completedHours: 5,
        },
        {
          moduleInstanceId: 'mi-1',
          assigneeId: 'user-1',
          workItemType: bugType,
          status: todoStatus,
          priority: lowPriority,
          estimateHours: 3,
          completedHours: 0,
        },
        {
          moduleInstanceId: 'mi-1',
          assigneeId: null,
          workItemType: taskType,
          status: todoStatus,
          priority: null,
          estimateHours: null,
          completedHours: null,
        },
      ]);

      prisma.projectMember.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          user: {
            id: 'user-1',
            email: 'jane.doe@acme.com',
            firstName: 'Jane',
            lastName: 'Doe',
          },
        },
        {
          userId: 'user-2',
          user: {
            id: 'user-2',
            email: 'noname@acme.com',
            firstName: null,
            lastName: null,
          },
        },
      ]);

      prisma.ticketStatus.findMany.mockResolvedValue([
        { name: 'To Do', color: '#ccc', order: 0 },
        { name: 'Done', color: '#0f0', order: 1 },
      ]);

      const report = await service.getProjectReport(workspaceId, projectId);

      // modules
      expect(report.modules).toEqual([
        { id: 'mi-1', module: 'Sprint Board', used: 1, limit: 10, addon: 2 },
      ]);

      // statusBreakdown: every configured status represented
      expect(report.statusBreakdown).toEqual([
        { name: 'To Do', color: '#ccc', count: 2 },
        { name: 'Done', color: '#0f0', count: 1 },
      ]);

      // byPriority
      expect(report.byPriority).toEqual(
        expect.arrayContaining([
          { priority: 'High', statuses: { Done: 1 } },
          { priority: 'Low', statuses: { 'To Do': 1 } },
          { priority: 'Unassigned', statuses: { 'To Do': 1 } },
        ]),
      );

      // byType: sorted by total desc
      expect(report.byType).toEqual([
        { name: 'Task', category: 'task', color: '#3b82f6', total: 2, done: 1 },
        { name: 'Bug', category: 'bug', color: '#ef4444', total: 1, done: 0 },
      ]);

      // progress: 1 of 3 done => 33%
      expect(report.progress).toEqual({
        totalItems: 3,
        doneItems: 1,
        percentComplete: 33,
        stage: 'Early Stage',
      });

      // user workload
      expect(report.user).toEqual(
        expect.arrayContaining([
          {
            name: 'Jane Doe',
            totalItems: 2,
            completedItems: 1,
            totalEstimateHours: 8,
            totalCompletedHours: 5,
            loggedMinutes: 0,
            byType: { Task: 1, Bug: 1 },
          },
          {
            name: 'noname',
            totalItems: 0,
            completedItems: 0,
            totalEstimateHours: 0,
            totalCompletedHours: 0,
            loggedMinutes: 0,
            byType: {},
          },
        ]),
      );
    });

    it('handles an empty project with no work items (progress 0%, stage Not Started)', async () => {
      prisma.project.findFirst.mockResolvedValue({
        id: projectId,
        workspaceId,
      });
      prisma.moduleInstance.findMany.mockResolvedValue([]);
      prisma.workItem.findMany.mockResolvedValue([]);
      prisma.projectMember.findMany.mockResolvedValue([]);
      prisma.ticketStatus.findMany.mockResolvedValue([]);

      const report = await service.getProjectReport(workspaceId, projectId);

      expect(report.modules).toEqual([]);
      expect(report.statusBreakdown).toEqual([]);
      expect(report.byPriority).toEqual([]);
      expect(report.byType).toEqual([]);
      expect(report.progress).toEqual({
        totalItems: 0,
        doneItems: 0,
        percentComplete: 0,
        stage: 'Not Started',
      });
      expect(report.user).toEqual([]);
    });
  });

  describe('getWorkspaceReport()', () => {
    const workspaceId = 'ws-1';

    it('groups live work items by type and by type+status label', async () => {
      prisma.workItem.findMany.mockResolvedValue([
        {
          workItemType: { name: 'Task', category: 'task' },
          status: { name: 'To Do' },
        },
        {
          workItemType: { name: 'Task', category: 'task' },
          status: { name: 'To Do' },
        },
        {
          workItemType: { name: 'Bug', category: 'bug' },
          status: { name: 'Done' },
        },
        {
          workItemType: null,
          status: null,
        },
      ]);

      const report = await service.getWorkspaceReport(workspaceId);

      expect(prisma.workItem.findMany).toHaveBeenCalledWith({
        where: {
          project: { workspaceId, deletedAt: null },
          NOT: { status: { is: { category: 'removed' } } },
        },
        select: {
          workItemType: { select: { name: true, category: true } },
          status: { select: { name: true } },
        },
      });

      expect(report.totalItems).toBe(4);
      expect(report.byType).toEqual([
        { name: 'Task', count: 2 },
        { name: 'Bug', count: 1 },
        { name: 'Uncategorized', count: 1 },
      ]);
      expect(report.statusBreakdown).toEqual([
        { label: 'Task · To Do', count: 2 },
        { label: 'Bug · Done', count: 1 },
        { label: 'Uncategorized · No status', count: 1 },
      ]);
    });

    it('returns zeroed output when the workspace has no live work items', async () => {
      prisma.workItem.findMany.mockResolvedValue([]);

      const report = await service.getWorkspaceReport(workspaceId);

      expect(report).toEqual({
        totalItems: 0,
        byType: [],
        statusBreakdown: [],
      });
    });
  });

  describe('displayName() (module-level helper, exercised via user workload in getProjectReport)', () => {
    const workspaceId = 'ws-1';
    const projectId = 'proj-1';

    beforeEach(() => {
      prisma.project.findFirst.mockResolvedValue({
        id: projectId,
        workspaceId,
      });
      prisma.moduleInstance.findMany.mockResolvedValue([]);
      prisma.workItem.findMany.mockResolvedValue([]);
      prisma.ticketStatus.findMany.mockResolvedValue([]);
    });

    it('uses "firstName lastName" when both are present', async () => {
      prisma.projectMember.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          user: {
            id: 'user-1',
            email: 'jane.doe@acme.com',
            firstName: 'Jane',
            lastName: 'Doe',
          },
        },
      ]);

      const report = await service.getProjectReport(workspaceId, projectId);
      expect(report.user[0].name).toBe('Jane Doe');
    });

    it('falls back to the email local-part (never the full email) when firstName and lastName are absent', async () => {
      prisma.projectMember.findMany.mockResolvedValue([
        {
          userId: 'user-2',
          user: {
            id: 'user-2',
            email: 'jane@acme.com',
            firstName: null,
            lastName: null,
          },
        },
      ]);

      const report = await service.getProjectReport(workspaceId, projectId);
      expect(report.user[0].name).toBe('jane');
      expect(report.user[0].name).not.toBe('jane@acme.com');
      expect(report.user[0].name).not.toContain('@');
    });
  });
});
