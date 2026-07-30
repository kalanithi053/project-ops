import { Test, TestingModule } from '@nestjs/testing';
import { ActivityLogService } from './activity-log.service';
import { PrismaService } from '../prisma/prisma.service';

// Re-import the module-level `displayName` helper indirectly is not possible
// (it's not exported), so we exercise it through getTimeline()'s output and
// through a small re-implementation-free approach: we assert behavior via the
// public surface. See the dedicated "displayName via actor/user resolution"
// describe block below.

describe('ActivityLogService', () => {
  let service: ActivityLogService;
  let prisma: {
    activityLog: { create: jest.Mock; findMany: jest.Mock };
    ticketStatus: { findMany: jest.Mock };
    priority: { findMany: jest.Mock };
    user: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      activityLog: { create: jest.fn(), findMany: jest.fn() },
      ticketStatus: { findMany: jest.fn() },
      priority: { findMany: jest.fn() },
      user: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityLogService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ActivityLogService);
  });

  describe('log()', () => {
    const params = {
      workspaceId: 'ws-1',
      entityType: 'task',
      entityId: 'task-1',
      action: 'created',
      userId: 'user-1',
      metadata: { foo: 'bar' },
    };

    it('uses this.prisma by default when no client is passed', async () => {
      prisma.activityLog.create.mockResolvedValue({ id: 'log-1', ...params });

      const result = await service.log(params);

      expect(prisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          workspaceId: 'ws-1',
          projectId: null,
          entityType: 'task',
          entityId: 'task-1',
          action: 'created',
          userId: 'user-1',
          metadata: { foo: 'bar' },
        },
      });
      expect(result).toEqual({ id: 'log-1', ...params });
    });

    it('defaults projectId to null when omitted', async () => {
      prisma.activityLog.create.mockResolvedValue({});
      await service.log(params);
      expect(
        prisma.activityLog.create.mock.calls[0][0].data.projectId,
      ).toBeNull();
    });

    it('includes projectId when provided', async () => {
      prisma.activityLog.create.mockResolvedValue({});
      await service.log({ ...params, projectId: 'proj-1' });
      expect(prisma.activityLog.create.mock.calls[0][0].data.projectId).toBe(
        'proj-1',
      );
    });

    it('writes through an explicit transaction client instead of this.prisma when one is passed', async () => {
      const txClient = {
        activityLog: { create: jest.fn().mockResolvedValue({ id: 'tx-log' }) },
      };

      const result = await service.log(params, txClient as any);

      expect(txClient.activityLog.create).toHaveBeenCalledTimes(1);
      expect(prisma.activityLog.create).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'tx-log' });
    });
  });

  describe('getTimeline()', () => {
    const actor = {
      id: 'user-1',
      email: 'jane.doe@acme.com',
      firstName: 'Jane',
      lastName: 'Doe',
    };

    it('returns an empty array when there are no log entries', async () => {
      prisma.activityLog.findMany.mockResolvedValue([]);

      const result = await service.getTimeline('ws-1', 'entity-1');

      expect(result).toEqual([]);
      // buildLookups should be short-circuited entirely (no lookup queries).
      expect(prisma.ticketStatus.findMany).not.toHaveBeenCalled();
      expect(prisma.priority.findMany).not.toHaveBeenCalled();
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('passes workspaceId, entityId and optional entityType to the query', async () => {
      prisma.activityLog.findMany.mockResolvedValue([]);
      await service.getTimeline('ws-1', 'entity-1', 'task');
      expect(prisma.activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workspaceId: 'ws-1',
            entityId: 'entity-1',
            entityType: 'task',
          },
        }),
      );
    });

    it('describes a "created" entry using the actor display name', async () => {
      prisma.activityLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          entityType: 'task',
          entityId: 'task-1',
          action: 'created',
          actor,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          metadata: null,
        },
      ]);
      prisma.ticketStatus.findMany.mockResolvedValue([]);
      prisma.priority.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.getTimeline('ws-1', 'task-1', 'task');

      expect(result).toEqual([
        {
          id: 'log-1',
          entityType: 'task',
          entityId: 'task-1',
          action: 'created',
          actor: 'Jane Doe',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          description: 'Jane Doe created this task',
          metadata: null,
        },
      ]);
    });

    it('describes a "comment_added" entry using the preview from metadata', async () => {
      prisma.activityLog.findMany.mockResolvedValue([
        {
          id: 'log-2',
          entityType: 'comment',
          entityId: 'comment-1',
          action: 'comment_added',
          actor,
          createdAt: new Date('2026-01-02T00:00:00Z'),
          metadata: { preview: 'Looks good to me' },
        },
      ]);
      prisma.ticketStatus.findMany.mockResolvedValue([]);
      prisma.priority.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);

      const [entry] = await service.getTimeline('ws-1', 'comment-1');

      expect(entry.description).toBe('Jane Doe commented: "Looks good to me"');
      expect(entry.metadata).toEqual({ preview: 'Looks good to me' });
    });

    it('describes an "updated" entry with a single changed field via lookups (statusId)', async () => {
      prisma.activityLog.findMany.mockResolvedValue([
        {
          id: 'log-3',
          entityType: 'task',
          entityId: 'task-1',
          action: 'updated',
          actor,
          createdAt: new Date('2026-01-03T00:00:00Z'),
          metadata: {
            changes: { statusId: { from: 'status-todo', to: 'status-done' } },
          },
        },
      ]);
      prisma.ticketStatus.findMany.mockResolvedValue([
        { id: 'status-todo', name: 'To Do' },
        { id: 'status-done', name: 'Done' },
      ]);
      prisma.priority.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);

      const [entry] = await service.getTimeline('ws-1', 'task-1', 'task');

      expect(prisma.ticketStatus.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: 'ws-1',
          id: { in: ['status-todo', 'status-done'] },
        },
        select: { id: true, name: true },
      });
      expect(entry.description).toBe('Jane Doe changed status to Done');
    });

    it('describes an "updated" entry with multiple changed fields as a joined list', async () => {
      prisma.activityLog.findMany.mockResolvedValue([
        {
          id: 'log-4',
          entityType: 'task',
          entityId: 'task-1',
          action: 'updated',
          actor,
          createdAt: new Date('2026-01-04T00:00:00Z'),
          metadata: {
            changes: {
              priorityId: { from: 'p-low', to: 'p-high' },
              dueDate: { from: null, to: '2026-02-01' },
            },
          },
        },
      ]);
      prisma.ticketStatus.findMany.mockResolvedValue([]);
      prisma.priority.findMany.mockResolvedValue([
        { id: 'p-low', name: 'Low' },
        { id: 'p-high', name: 'High' },
      ]);
      prisma.user.findMany.mockResolvedValue([]);

      const [entry] = await service.getTimeline('ws-1', 'task-1', 'task');

      expect(entry.description).toBe('Jane Doe updated priority, due date');
    });

    it('falls back to "Someone" when the actor is null', async () => {
      prisma.activityLog.findMany.mockResolvedValue([
        {
          id: 'log-5',
          entityType: 'task',
          entityId: 'task-1',
          action: 'deleted',
          actor: null,
          createdAt: new Date('2026-01-05T00:00:00Z'),
          metadata: null,
        },
      ]);
      prisma.ticketStatus.findMany.mockResolvedValue([]);
      prisma.priority.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);

      const [entry] = await service.getTimeline('ws-1', 'task-1', 'task');

      expect(entry.actor).toBe('Someone');
      expect(entry.description).toBe('Someone deleted this task');
    });

    it('resolves an assigneeId change through the user lookup, using local-part fallback when the assignee has no name', async () => {
      prisma.activityLog.findMany.mockResolvedValue([
        {
          id: 'log-6',
          entityType: 'task',
          entityId: 'task-1',
          action: 'updated',
          actor,
          createdAt: new Date('2026-01-06T00:00:00Z'),
          metadata: {
            changes: { assigneeId: { from: null, to: 'user-2' } },
          },
        },
      ]);
      prisma.ticketStatus.findMany.mockResolvedValue([]);
      prisma.priority.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'user-2',
          email: 'noname@acme.com',
          firstName: null,
          lastName: null,
        },
      ]);

      const [entry] = await service.getTimeline('ws-1', 'task-1', 'task');

      expect(entry.description).toBe('Jane Doe assigned it to noname');
    });
  });

  describe('displayName() (module-level helper, exercised via getTimeline actor resolution)', () => {
    it('uses "firstName lastName" when both are present', async () => {
      prisma.activityLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          entityType: 'task',
          entityId: 'task-1',
          action: 'created',
          actor: {
            id: 'user-1',
            email: 'jane.doe@acme.com',
            firstName: 'Jane',
            lastName: 'Doe',
          },
          createdAt: new Date(),
          metadata: null,
        },
      ]);
      prisma.ticketStatus.findMany.mockResolvedValue([]);
      prisma.priority.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);

      const [entry] = await service.getTimeline('ws-1', 'task-1');
      expect(entry.actor).toBe('Jane Doe');
    });

    it('falls back to the email local-part (never the full email) when firstName and lastName are both absent', async () => {
      prisma.activityLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          entityType: 'task',
          entityId: 'task-1',
          action: 'created',
          actor: {
            id: 'user-1',
            email: 'jane@acme.com',
            firstName: null,
            lastName: null,
          },
          createdAt: new Date(),
          metadata: null,
        },
      ]);
      prisma.ticketStatus.findMany.mockResolvedValue([]);
      prisma.priority.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);

      const [entry] = await service.getTimeline('ws-1', 'task-1');
      expect(entry.actor).toBe('jane');
      expect(entry.actor).not.toBe('jane@acme.com');
      expect(entry.actor).not.toContain('@');
    });
  });
});
