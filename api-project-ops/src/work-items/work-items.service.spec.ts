import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkItemsService } from './work-items.service';

describe('WorkItemsService', () => {
  let service: WorkItemsService;

  const workspaceId = 'ws-1';
  const projectId = 'proj-1';
  const userId = 'user-1';
  const workItemId = 'wi-1';

  const mockPrismaService = {
    workItem: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    project: {
      findFirst: jest.fn(),
    },
    moduleInstance: {
      findFirst: jest.fn(),
    },
    workType: {
      findFirst: jest.fn(),
    },
    ticketStatus: {
      findFirst: jest.fn(),
    },
    priority: {
      findFirst: jest.fn(),
    },
    workspaceMember: {
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockActivityLog = {
    log: jest.fn(),
    getTimeline: jest.fn(),
  };

  const mockMail = {
    sendWorkItemNotificationEmail: jest.fn(),
    appUrl: jest.fn((path: string) => `https://app.test${path}`),
  };

  const project = {
    id: projectId,
    workspaceId,
    name: 'Test Project',
    ownerId: 'owner-1',
    deletedAt: null,
    owner: { id: 'owner-1', email: 'owner@test.com' },
    workspace: { slug: 'test-ws' },
  };

  function makeWorkItem(overrides: Record<string, unknown> = {}) {
    return {
      id: workItemId,
      projectId,
      moduleInstanceId: 'mod-1',
      workItemTypeId: null,
      name: 'Test Item',
      prefix: null,
      description: null,
      startDate: null,
      dueDate: null,
      statusId: null,
      priorityId: null,
      assigneeId: null,
      qaAssigneeId: null,
      createdBy: userId,
      estimateHours: null,
      completedHours: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      workItemType: null,
      status: null,
      priority: null,
      assignee: null,
      qaAssignee: null,
      creator: { id: userId, email: 'creator@test.com' },
      ...overrides,
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrismaService.$transaction.mockImplementation((cb: any) =>
      cb(mockPrismaService),
    );
    mockMail.sendWorkItemNotificationEmail.mockResolvedValue(undefined);
    mockActivityLog.log.mockResolvedValue({ id: 'log-1' });

    const module = await Test.createTestingModule({
      providers: [
        WorkItemsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ActivityLogService, useValue: mockActivityLog },
        { provide: MailService, useValue: mockMail },
      ],
    }).compile();

    service = module.get(WorkItemsService);
  });

  describe('list', () => {
    it('returns work items for a project ordered by position then createdAt asc', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(project);
      const items = [makeWorkItem()];
      mockPrismaService.workItem.findMany.mockResolvedValue(items);

      const result = await service.list(workspaceId, projectId);

      expect(mockPrismaService.workItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        }),
      );
      expect(result).toEqual(items);
    });

    it('throws NotFoundException when the project does not exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(service.list(workspaceId, projectId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.workItem.findMany).not.toHaveBeenCalled();
    });

    it('filters by a case-insensitive match on name or prefix', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(project);
      mockPrismaService.workItem.findMany.mockResolvedValue([]);

      await service.list(workspaceId, projectId, { search: 'pipelines' });

      expect(mockPrismaService.workItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            projectId,
            AND: [
              {
                OR: [
                  { name: { contains: 'pipelines', mode: 'insensitive' } },
                  { prefix: { contains: 'pipelines', mode: 'insensitive' } },
                ],
              },
            ],
          },
        }),
      );
    });

    it('filters by assigneeIds', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(project);
      mockPrismaService.workItem.findMany.mockResolvedValue([]);

      await service.list(workspaceId, projectId, {
        assigneeIds: ['user-1', 'user-2'],
      });

      expect(mockPrismaService.workItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            projectId,
            AND: [{ assigneeId: { in: ['user-1', 'user-2'] } }],
          },
        }),
      );
    });

    it('merges moduleInstanceId and moduleInstanceIds into one filter', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(project);
      mockPrismaService.workItem.findMany.mockResolvedValue([]);

      await service.list(workspaceId, projectId, {
        moduleInstanceId: 'mod-1',
        moduleInstanceIds: ['mod-1', 'mod-2'],
      });

      expect(mockPrismaService.workItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            projectId,
            AND: [{ moduleInstanceId: { in: ['mod-1', 'mod-2'] } }],
          },
        }),
      );
    });

    it('filters by statusIds', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(project);
      mockPrismaService.workItem.findMany.mockResolvedValue([]);

      await service.list(workspaceId, projectId, {
        statusIds: ['status-1', 'status-2'],
      });

      expect(mockPrismaService.workItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            projectId,
            AND: [{ statusId: { in: ['status-1', 'status-2'] } }],
          },
        }),
      );
    });

    it('translates the "__unassigned__" sentinel status into a null match', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(project);
      mockPrismaService.workItem.findMany.mockResolvedValue([]);

      await service.list(workspaceId, projectId, {
        statusId: '__unassigned__',
      });

      expect(mockPrismaService.workItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId, AND: [{ statusId: null }] },
        }),
      );
    });

    it('ORs real statuses with a null match when the sentinel is mixed in', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(project);
      mockPrismaService.workItem.findMany.mockResolvedValue([]);

      await service.list(workspaceId, projectId, {
        statusIds: ['status-1', '__unassigned__'],
      });

      expect(mockPrismaService.workItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            projectId,
            AND: [
              { OR: [{ statusId: { in: ['status-1'] } }, { statusId: null }] },
            ],
          },
        }),
      );
    });

    it('filters by priorityId and a start/end date range', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(project);
      mockPrismaService.workItem.findMany.mockResolvedValue([]);

      await service.list(workspaceId, projectId, {
        priorityId: 'priority-1',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });

      expect(mockPrismaService.workItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            projectId,
            AND: [
              { priorityId: 'priority-1' },
              { startDate: { gte: new Date('2026-08-01') } },
              { dueDate: { lte: new Date('2026-08-31') } },
            ],
          },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns the work item when found', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(project);
      const item = makeWorkItem();
      mockPrismaService.workItem.findFirst.mockResolvedValue(item);

      const result = await service.findOne(workspaceId, projectId, workItemId);

      expect(result).toEqual(item);
    });

    it('throws NotFoundException when the work item does not exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(project);
      mockPrismaService.workItem.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(workspaceId, projectId, 'missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const minimalDto = { name: 'New Item', moduleInstanceId: 'mod-1' };

    beforeEach(() => {
      mockPrismaService.project.findFirst.mockResolvedValue(project);
      mockPrismaService.moduleInstance.findFirst.mockResolvedValue({
        id: 'mod-1',
        projectId,
      });
      // No existing rows — the new item appends at the start of the flat
      // ordering (see POSITION_GAP's own doc comment for why it's spaced).
      mockPrismaService.workItem.aggregate.mockResolvedValue({
        _max: { position: null },
      });
    });

    it('creates a work item, logs activity, and emails the project owner', async () => {
      const created = makeWorkItem({ name: 'New Item', assignee: null });
      mockPrismaService.workItem.create.mockResolvedValue(created);

      const result = await service.create(
        workspaceId,
        projectId,
        userId,
        minimalDto,
      );

      expect(mockPrismaService.workItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId,
            moduleInstanceId: 'mod-1',
            name: 'New Item',
            createdBy: userId,
            workItemTypeId: null,
          }),
        }),
      );
      expect(mockActivityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId,
          projectId,
          entityType: 'task',
          entityId: workItemId,
          action: 'created',
          userId,
        }),
        mockPrismaService,
      );
      expect(mockMail.sendWorkItemNotificationEmail).toHaveBeenCalledTimes(1);
      expect(mockMail.sendWorkItemNotificationEmail).toHaveBeenCalledWith(
        project.owner.email,
        expect.objectContaining({ action: 'created', entityType: 'task' }),
      );
      expect(result).toEqual(created);
    });

    it('resolves the activity entityType from the referenced work type category', async () => {
      mockPrismaService.workType.findFirst.mockResolvedValue({
        id: 'wt-1',
        workspaceId,
        category: 'bug',
      });
      const created = makeWorkItem({ workItemTypeId: 'wt-1', assignee: null });
      mockPrismaService.workItem.create.mockResolvedValue(created);

      await service.create(workspaceId, projectId, userId, {
        ...minimalDto,
        workItemTypeId: 'wt-1',
      });

      expect(mockActivityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'bug' }),
        mockPrismaService,
      );
      expect(mockMail.sendWorkItemNotificationEmail).toHaveBeenCalledWith(
        project.owner.email,
        expect.objectContaining({ entityType: 'bug' }),
      );
    });

    it('notifies the owner, assignee, and qa assignee (deduped) on creation', async () => {
      mockPrismaService.workspaceMember.findFirst.mockResolvedValue({
        id: 'member-1',
      });
      const created = makeWorkItem({
        assigneeId: 'assignee-1',
        assignee: { id: 'assignee-1', email: 'assignee@test.com' },
        qaAssigneeId: 'qa-1',
        qaAssignee: { id: 'qa-1', email: 'qa@test.com' },
      });
      mockPrismaService.workItem.create.mockResolvedValue(created);

      await service.create(workspaceId, projectId, userId, {
        ...minimalDto,
        assigneeId: 'assignee-1',
        qaAssigneeId: 'qa-1',
      });

      expect(mockMail.sendWorkItemNotificationEmail).toHaveBeenCalledTimes(3);
      const recipients = mockMail.sendWorkItemNotificationEmail.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(recipients).toEqual(
        expect.arrayContaining([
          project.owner.email,
          'assignee@test.com',
          'qa@test.com',
        ]),
      );
    });

    it('throws NotFoundException when the project does not exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.create(workspaceId, projectId, userId, minimalDto as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the module instance is not in the project', async () => {
      // moduleInstanceId is only required/validated for 'task' category items.
      mockPrismaService.workType.findFirst.mockResolvedValue({
        id: 'wt-task',
        category: 'task',
      });
      mockPrismaService.moduleInstance.findFirst.mockResolvedValue(null);

      await expect(
        service.create(workspaceId, projectId, userId, {
          ...minimalDto,
          workItemTypeId: 'wt-task',
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.workItem.create).not.toHaveBeenCalled();
    });

    it('does not require moduleInstanceId for a non-task category item', async () => {
      mockPrismaService.workType.findFirst.mockResolvedValue({
        id: 'wt-bug',
        category: 'bug',
      });
      mockPrismaService.workItem.create.mockResolvedValue({
        id: 'wi-bug',
        moduleInstanceId: null,
      });

      const result = await service.create(workspaceId, projectId, userId, {
        name: 'Bug without a module',
        workItemTypeId: 'wt-bug',
      });

      expect(mockPrismaService.moduleInstance.findFirst).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'wi-bug', moduleInstanceId: null });
    });

    it('throws BadRequestException when a task item omits moduleInstanceId', async () => {
      mockPrismaService.workType.findFirst.mockResolvedValue({
        id: 'wt-task',
        category: 'task',
      });

      await expect(
        service.create(workspaceId, projectId, userId, {
          name: 'Task without a module',
          workItemTypeId: 'wt-task',
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.workItem.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when workItemTypeId is not in the workspace', async () => {
      mockPrismaService.workType.findFirst.mockResolvedValue(null);

      await expect(
        service.create(workspaceId, projectId, userId, {
          ...minimalDto,
          workItemTypeId: 'bad-wt',
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.workItem.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when statusId is not in the workspace', async () => {
      mockPrismaService.ticketStatus.findFirst.mockResolvedValue(null);

      await expect(
        service.create(workspaceId, projectId, userId, {
          ...minimalDto,
          statusId: 'bad-status',
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.workItem.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when priorityId is not in the workspace', async () => {
      mockPrismaService.priority.findFirst.mockResolvedValue(null);

      await expect(
        service.create(workspaceId, projectId, userId, {
          ...minimalDto,
          priorityId: 'bad-priority',
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.workItem.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when assigneeId is not a workspace member', async () => {
      mockPrismaService.workspaceMember.findFirst.mockResolvedValue(null);

      await expect(
        service.create(workspaceId, projectId, userId, {
          ...minimalDto,
          assigneeId: 'not-a-member',
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.workItem.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when qaAssigneeId is not a workspace member', async () => {
      mockPrismaService.workspaceMember.findFirst.mockResolvedValue(null);

      await expect(
        service.create(workspaceId, projectId, userId, {
          ...minimalDto,
          qaAssigneeId: 'not-a-member',
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.workItem.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    beforeEach(() => {
      mockPrismaService.project.findFirst.mockResolvedValue(project);
    });

    it('logs the diff and notifies on a real change', async () => {
      const existing = makeWorkItem({ name: 'Old Name', assignee: null });
      mockPrismaService.workItem.findFirst.mockResolvedValue(existing);
      const updated = makeWorkItem({ name: 'New Name', assignee: null });
      mockPrismaService.workItem.update.mockResolvedValue(updated);

      const result = await service.update(
        workspaceId,
        projectId,
        workItemId,
        userId,
        { name: 'New Name' },
      );

      expect(mockActivityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityId: workItemId,
          metadata: {
            changes: { name: { from: 'Old Name', to: 'New Name' } },
          },
        }),
        mockPrismaService,
      );
      expect(mockMail.sendWorkItemNotificationEmail).toHaveBeenCalledWith(
        project.owner.email,
        expect.objectContaining({ action: 'updated' }),
      );
      expect(result).toEqual(updated);
    });

    it('does nothing when the patch does not actually change any tracked field', async () => {
      const existing = makeWorkItem({ name: 'Same Name', assignee: null });
      mockPrismaService.workItem.findFirst.mockResolvedValue(existing);
      mockPrismaService.workItem.update.mockResolvedValue(existing);

      await service.update(workspaceId, projectId, workItemId, userId, {
        name: 'Same Name',
      });

      expect(mockActivityLog.log).not.toHaveBeenCalled();
      expect(mockMail.sendWorkItemNotificationEmail).not.toHaveBeenCalled();
    });

    it('notifies the new assignee of the reassignment and skips double-notifying them in the update email', async () => {
      mockPrismaService.workspaceMember.findFirst.mockResolvedValue({
        id: 'member-1',
      });
      const existing = makeWorkItem({ assigneeId: null, assignee: null });
      mockPrismaService.workItem.findFirst.mockResolvedValue(existing);
      const updated = makeWorkItem({
        assigneeId: 'assignee-1',
        assignee: { id: 'assignee-1', email: 'assignee@test.com' },
      });
      mockPrismaService.workItem.update.mockResolvedValue(updated);
      mockPrismaService.user.findUnique.mockResolvedValue({
        email: 'actor@test.com',
        firstName: 'Ann',
        lastName: 'Actor',
      });

      await service.update(workspaceId, projectId, workItemId, userId, {
        assigneeId: 'assignee-1',
      });

      expect(mockMail.sendWorkItemNotificationEmail).toHaveBeenCalledTimes(2);
      expect(mockMail.sendWorkItemNotificationEmail).toHaveBeenCalledWith(
        'assignee@test.com',
        expect.objectContaining({ action: 'assigned', actorName: 'Ann Actor' }),
      );
      expect(mockMail.sendWorkItemNotificationEmail).toHaveBeenCalledWith(
        project.owner.email,
        expect.objectContaining({ action: 'updated' }),
      );
      // The assignee must not also receive a plain "updated" email.
      const assigneeCalls =
        mockMail.sendWorkItemNotificationEmail.mock.calls.filter(
          (call: unknown[]) => call[0] === 'assignee@test.com',
        );
      expect(assigneeCalls).toHaveLength(1);
    });

    it('throws NotFoundException when the work item does not exist', async () => {
      mockPrismaService.workItem.findFirst.mockResolvedValue(null);

      await expect(
        service.update(workspaceId, projectId, 'missing', userId, {
          name: 'X',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the new statusId is not in the workspace', async () => {
      const existing = makeWorkItem();
      mockPrismaService.workItem.findFirst.mockResolvedValue(existing);
      mockPrismaService.ticketStatus.findFirst.mockResolvedValue(null);

      await expect(
        service.update(workspaceId, projectId, workItemId, userId, {
          statusId: 'bad-status',
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.workItem.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes an existing work item', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(project);
      mockPrismaService.workItem.findFirst.mockResolvedValue(makeWorkItem());
      mockPrismaService.workItem.delete.mockResolvedValue({ id: workItemId });

      const result = await service.remove(workspaceId, projectId, workItemId);

      expect(mockPrismaService.workItem.delete).toHaveBeenCalledWith({
        where: { id: workItemId },
      });
      expect(result).toEqual({ id: workItemId, deleted: true });
    });

    it('throws NotFoundException when the work item does not exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(project);
      mockPrismaService.workItem.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(workspaceId, projectId, 'missing'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.workItem.delete).not.toHaveBeenCalled();
    });
  });

  describe('getActivity', () => {
    it('delegates to activityLog.getTimeline by workspace and id', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(project);
      mockPrismaService.workItem.findFirst.mockResolvedValue(makeWorkItem());
      const timeline = [{ id: 'log-1', action: 'created' }];
      mockActivityLog.getTimeline.mockResolvedValue(timeline);

      const result = await service.getActivity(
        workspaceId,
        projectId,
        workItemId,
      );

      expect(mockActivityLog.getTimeline).toHaveBeenCalledWith(
        workspaceId,
        workItemId,
      );
      expect(result).toEqual(timeline);
    });

    it('throws NotFoundException when the work item does not exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(project);
      mockPrismaService.workItem.findFirst.mockResolvedValue(null);

      await expect(
        service.getActivity(workspaceId, projectId, 'missing'),
      ).rejects.toThrow(NotFoundException);
      expect(mockActivityLog.getTimeline).not.toHaveBeenCalled();
    });
  });

  describe('notifyAssignee', () => {
    it('emails the assignee a reminder and returns their email', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(project);
      const workItem = makeWorkItem({
        prefix: 'ABC',
        workItemType: { id: 'wt-1', name: 'Bug', category: 'bug' },
        assignee: { id: 'assignee-1', email: 'assignee@test.com' },
      });
      mockPrismaService.workItem.findFirst.mockResolvedValue(workItem);

      const result = await service.notifyAssignee(
        workspaceId,
        projectId,
        workItemId,
      );

      expect(mockMail.sendWorkItemNotificationEmail).toHaveBeenCalledWith(
        'assignee@test.com',
        expect.objectContaining({ action: 'reminder', entityType: 'bug' }),
      );
      expect(result).toEqual({
        notified: true,
        assignee: 'assignee@test.com',
      });
    });

    it('throws BadRequestException when the work item has no assignee', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(project);
      mockPrismaService.workItem.findFirst.mockResolvedValue(
        makeWorkItem({ assignee: null }),
      );

      await expect(
        service.notifyAssignee(workspaceId, projectId, workItemId),
      ).rejects.toThrow(BadRequestException);
      expect(mockMail.sendWorkItemNotificationEmail).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the project does not exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.notifyAssignee(workspaceId, projectId, workItemId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
