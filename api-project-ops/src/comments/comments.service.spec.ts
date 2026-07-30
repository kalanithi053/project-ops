import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CommentsService } from './comments.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * `plainTextPreview` is a module-scope helper, not exported. We exercise it
 * indirectly by inspecting the `metadata.preview` passed to
 * `activityLog.log()` during create()/update(), which is sufficient to pin
 * its stripping behavior without re-implementing it here.
 */

describe('CommentsService', () => {
  let service: CommentsService;
  let prisma: {
    comment: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
    workspaceMember: { findMany: jest.Mock };
    workItem: { findFirst: jest.Mock };
    workspace: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let activityLog: { log: jest.Mock };
  let mail: { sendCommentMentionEmail: jest.Mock; appUrl: jest.Mock };

  const AUTHOR = {
    id: 'user-author',
    email: 'author@acme.com',
    firstName: 'Ann',
    lastName: 'Author',
  };
  const MENTIONED_USER = {
    id: 'user-mentioned',
    email: 'john@acme.com',
    firstName: 'John',
    lastName: 'Smith',
  };

  // Fake transaction client used by $transaction mock — reuses the same
  // jest.fn()s as `prisma` unless a test wants distinct behavior on tx.
  let txComment: { create: jest.Mock; update: jest.Mock; delete: jest.Mock };

  beforeEach(async () => {
    txComment = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    prisma = {
      comment: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      workspaceMember: { findMany: jest.fn() },
      workItem: { findFirst: jest.fn() },
      workspace: { findUnique: jest.fn() },
      $transaction: jest.fn(async (cb) => cb({ comment: txComment })),
    };

    activityLog = { log: jest.fn().mockResolvedValue({ id: 'log-1' }) };
    mail = {
      sendCommentMentionEmail: jest.fn().mockResolvedValue(undefined),
      appUrl: jest.fn((path: string) => `https://app.acme.com${path}`),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ActivityLogService, useValue: activityLog },
        { provide: MailService, useValue: mail },
      ],
    }).compile();

    service = module.get(CommentsService);
  });

  // ---------------------------------------------------------------------
  // Generic workspace-scoped comments
  // ---------------------------------------------------------------------

  describe('list()', () => {
    it('lists comments for a workspace ordered by createdAt asc', async () => {
      const rows = [{ id: 'c1' }];
      prisma.comment.findMany.mockResolvedValue(rows);

      const result = await service.list('ws-1');

      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: 'ws-1' },
          orderBy: { createdAt: 'asc' },
        }),
      );
      expect(result).toBe(rows);
    });
  });

  describe('create()', () => {
    it('creates a comment with no mentions and logs comment_added', async () => {
      prisma.workspaceMember.findMany.mockResolvedValue([]);
      const created = {
        id: 'c1',
        body: 'hello',
        author: AUTHOR,
        mentions: [],
      };
      txComment.create.mockResolvedValue(created);

      const result = await service.create('ws-1', AUTHOR.id, { body: 'hello' });

      expect(txComment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspaceId: 'ws-1',
            authorId: AUTHOR.id,
            body: 'hello',
          }),
        }),
      );
      expect(activityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          entityType: 'comment',
          entityId: 'c1',
          action: 'comment_added',
          userId: AUTHOR.id,
          metadata: { preview: 'hello' },
        }),
        expect.anything(),
      );
      expect(mail.sendCommentMentionEmail).not.toHaveBeenCalled();
      expect(result).toBe(created);
    });

    it('resolves mentions to user ids and creates CommentMention rows', async () => {
      prisma.workspaceMember.findMany.mockResolvedValue([
        { userId: MENTIONED_USER.id, user: { email: MENTIONED_USER.email } },
      ]);
      const created = {
        id: 'c1',
        body: 'hi @john',
        author: AUTHOR,
        mentions: [{ user: MENTIONED_USER }],
      };
      txComment.create.mockResolvedValue(created);

      await service.create('ws-1', AUTHOR.id, {
        body: 'hi @john',
        mentions: [MENTIONED_USER.email],
      });

      expect(txComment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mentions: {
              createMany: {
                data: [{ userId: MENTIONED_USER.id }],
                skipDuplicates: true,
              },
            },
          }),
        }),
      );
    });

    it('throws BadRequestException when a mentioned email is not a workspace member', async () => {
      prisma.workspaceMember.findMany.mockResolvedValue([]);

      await expect(
        service.create('ws-1', AUTHOR.id, {
          body: 'hi',
          mentions: ['ghost@acme.com'],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('sends a mention email to a mentioned user other than the author', async () => {
      prisma.workspaceMember.findMany.mockResolvedValue([
        { userId: MENTIONED_USER.id, user: { email: MENTIONED_USER.email } },
      ]);
      const created = {
        id: 'c1',
        body: 'hi @john',
        author: AUTHOR,
        mentions: [{ user: MENTIONED_USER }],
      };
      txComment.create.mockResolvedValue(created);
      prisma.workspace.findUnique.mockResolvedValue({
        name: 'Acme Co',
        slug: 'acme',
      });

      await service.create('ws-1', AUTHOR.id, {
        body: 'hi @john',
        mentions: [MENTIONED_USER.email],
      });

      expect(mail.sendCommentMentionEmail).toHaveBeenCalledWith(
        MENTIONED_USER.email,
        expect.objectContaining({
          authorName: 'Ann Author',
          workspaceName: 'Acme Co',
          body: 'hi @john',
        }),
      );
    });

    it('does not email the author even if they mention themselves', async () => {
      prisma.workspaceMember.findMany.mockResolvedValue([
        { userId: AUTHOR.id, user: { email: AUTHOR.email } },
      ]);
      const created = {
        id: 'c1',
        body: 'hi @me',
        author: AUTHOR,
        mentions: [{ user: AUTHOR }],
      };
      txComment.create.mockResolvedValue(created);

      await service.create('ws-1', AUTHOR.id, {
        body: 'hi @me',
        mentions: [AUTHOR.email],
      });

      expect(mail.sendCommentMentionEmail).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('updates the comment body when called by the author', async () => {
      prisma.comment.findFirst.mockResolvedValue({
        id: 'c1',
        authorId: AUTHOR.id,
        mentions: [],
      });
      const updated = {
        id: 'c1',
        body: 'edited',
        author: AUTHOR,
        mentions: [],
      };
      txComment.update.mockResolvedValue(updated);

      const result = await service.update('ws-1', 'c1', AUTHOR.id, {
        body: 'edited',
      });

      expect(activityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'comment_updated', entityId: 'c1' }),
        expect.anything(),
      );
      expect(result).toBe(updated);
    });

    it('throws NotFoundException when the comment does not belong to the workspace', async () => {
      prisma.comment.findFirst.mockResolvedValue(null);

      await expect(
        service.update('ws-1', 'missing', AUTHOR.id, { body: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when a non-author tries to update', async () => {
      prisma.comment.findFirst.mockResolvedValue({
        id: 'c1',
        authorId: AUTHOR.id,
        mentions: [],
      });

      await expect(
        service.update('ws-1', 'c1', 'someone-else', { body: 'x' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('only emails newly-added mentions, not ones already present before the edit', async () => {
      prisma.comment.findFirst.mockResolvedValue({
        id: 'c1',
        authorId: AUTHOR.id,
        mentions: [{ userId: MENTIONED_USER.id }], // already mentioned before edit
      });
      prisma.workspaceMember.findMany.mockResolvedValue([
        { userId: MENTIONED_USER.id, user: { email: MENTIONED_USER.email } },
      ]);
      const updated = {
        id: 'c1',
        body: 'edited @john',
        author: AUTHOR,
        mentions: [{ user: MENTIONED_USER }],
      };
      txComment.update.mockResolvedValue(updated);

      await service.update('ws-1', 'c1', AUTHOR.id, {
        body: 'edited @john',
        mentions: [MENTIONED_USER.email],
      });

      expect(mail.sendCommentMentionEmail).not.toHaveBeenCalled();
    });
  });

  describe('remove()', () => {
    it('deletes the comment and logs comment_deleted when called by the author', async () => {
      prisma.comment.findFirst.mockResolvedValue({
        id: 'c1',
        authorId: AUTHOR.id,
        mentions: [],
      });

      const result = await service.remove('ws-1', 'c1', AUTHOR.id);

      expect(txComment.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
      expect(activityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'comment_deleted', entityId: 'c1' }),
        expect.anything(),
      );
      expect(result).toEqual({ id: 'c1', deleted: true });
    });

    it('throws NotFoundException when the comment is missing', async () => {
      prisma.comment.findFirst.mockResolvedValue(null);

      await expect(
        service.remove('ws-1', 'missing', AUTHOR.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when called by a non-author', async () => {
      prisma.comment.findFirst.mockResolvedValue({
        id: 'c1',
        authorId: AUTHOR.id,
        mentions: [],
      });

      await expect(
        service.remove('ws-1', 'c1', 'someone-else'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------
  // Work-item-scoped comments
  // ---------------------------------------------------------------------

  const WORK_ITEM = {
    id: 'wi-1',
    projectId: 'proj-1',
    workItemType: { category: 'incident' },
  };

  describe('listForWorkItem()', () => {
    it('asserts the work item exists then lists its comments', async () => {
      prisma.workItem.findFirst.mockResolvedValue(WORK_ITEM);
      const rows = [{ id: 'c1' }];
      prisma.comment.findMany.mockResolvedValue(rows);

      const result = await service.listForWorkItem('ws-1', 'proj-1', 'wi-1');

      expect(prisma.workItem.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'wi-1',
            projectId: 'proj-1',
            project: { workspaceId: 'ws-1' },
          },
        }),
      );
      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { workItemId: 'wi-1' } }),
      );
      expect(result).toBe(rows);
    });

    it('throws NotFoundException when the work item does not exist', async () => {
      prisma.workItem.findFirst.mockResolvedValue(null);

      await expect(
        service.listForWorkItem('ws-1', 'proj-1', 'missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createForWorkItem()', () => {
    it('creates a comment on the work item, using its WorkType category as entityType', async () => {
      prisma.workItem.findFirst.mockResolvedValue(WORK_ITEM);
      prisma.workspaceMember.findMany.mockResolvedValue([]);
      const created = {
        id: 'c1',
        body: 'looks good',
        author: AUTHOR,
        mentions: [],
      };
      txComment.create.mockResolvedValue(created);

      const result = await service.createForWorkItem(
        'ws-1',
        'proj-1',
        'wi-1',
        AUTHOR.id,
        { body: 'looks good' },
      );

      expect(txComment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workItemId: 'wi-1',
            workspaceId: 'ws-1',
            authorId: AUTHOR.id,
          }),
        }),
      );
      expect(activityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          projectId: 'proj-1',
          entityType: 'incident',
          entityId: 'wi-1',
          action: 'comment_added',
          metadata: { commentId: 'c1', preview: 'looks good' },
        }),
        expect.anything(),
      );
      expect(result).toBe(created);
    });

    it('falls back to the default entityType ("task") when the work item has no WorkType', async () => {
      prisma.workItem.findFirst.mockResolvedValue({
        ...WORK_ITEM,
        workItemType: null,
      });
      prisma.workspaceMember.findMany.mockResolvedValue([]);
      txComment.create.mockResolvedValue({
        id: 'c1',
        body: 'x',
        author: AUTHOR,
        mentions: [],
      });

      await service.createForWorkItem('ws-1', 'proj-1', 'wi-1', AUTHOR.id, {
        body: 'x',
      });

      expect(activityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'task' }),
        expect.anything(),
      );
    });

    it('throws NotFoundException when the work item does not exist', async () => {
      prisma.workItem.findFirst.mockResolvedValue(null);

      await expect(
        service.createForWorkItem('ws-1', 'proj-1', 'missing', AUTHOR.id, {
          body: 'x',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for unknown mentioned emails', async () => {
      prisma.workItem.findFirst.mockResolvedValue(WORK_ITEM);
      prisma.workspaceMember.findMany.mockResolvedValue([]);

      await expect(
        service.createForWorkItem('ws-1', 'proj-1', 'wi-1', AUTHOR.id, {
          body: 'x',
          mentions: ['ghost@acme.com'],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateForWorkItem()', () => {
    it('updates the comment when called by its author', async () => {
      prisma.workItem.findFirst.mockResolvedValue(WORK_ITEM);
      prisma.comment.findFirst.mockResolvedValue({
        id: 'c1',
        authorId: AUTHOR.id,
        mentions: [],
      });
      const updated = {
        id: 'c1',
        body: 'edited',
        author: AUTHOR,
        mentions: [],
      };
      txComment.update.mockResolvedValue(updated);

      const result = await service.updateForWorkItem(
        'ws-1',
        'proj-1',
        'wi-1',
        'c1',
        AUTHOR.id,
        { body: 'edited' },
      );

      expect(activityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'comment_updated',
          entityId: 'wi-1',
          entityType: 'incident',
          metadata: { commentId: 'c1', preview: 'edited' },
        }),
        expect.anything(),
      );
      expect(result).toBe(updated);
    });

    it('throws NotFoundException when the work item is missing', async () => {
      prisma.workItem.findFirst.mockResolvedValue(null);

      await expect(
        service.updateForWorkItem(
          'ws-1',
          'proj-1',
          'missing',
          'c1',
          AUTHOR.id,
          {
            body: 'x',
          },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the comment does not belong to the work item', async () => {
      prisma.workItem.findFirst.mockResolvedValue(WORK_ITEM);
      prisma.comment.findFirst.mockResolvedValue(null);

      await expect(
        service.updateForWorkItem(
          'ws-1',
          'proj-1',
          'wi-1',
          'missing',
          AUTHOR.id,
          {
            body: 'x',
          },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when a non-author tries to update', async () => {
      prisma.workItem.findFirst.mockResolvedValue(WORK_ITEM);
      prisma.comment.findFirst.mockResolvedValue({
        id: 'c1',
        authorId: AUTHOR.id,
        mentions: [],
      });

      await expect(
        service.updateForWorkItem(
          'ws-1',
          'proj-1',
          'wi-1',
          'c1',
          'someone-else',
          { body: 'x' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('removeForWorkItem()', () => {
    it('deletes the comment and logs comment_deleted with commentId metadata', async () => {
      prisma.workItem.findFirst.mockResolvedValue(WORK_ITEM);
      prisma.comment.findFirst.mockResolvedValue({
        id: 'c1',
        authorId: AUTHOR.id,
        mentions: [],
      });

      const result = await service.removeForWorkItem(
        'ws-1',
        'proj-1',
        'wi-1',
        'c1',
        AUTHOR.id,
      );

      expect(txComment.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
      expect(activityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'comment_deleted',
          entityId: 'wi-1',
          entityType: 'incident',
          metadata: { commentId: 'c1' },
        }),
        expect.anything(),
      );
      expect(result).toEqual({ id: 'c1', deleted: true });
    });

    it('throws NotFoundException when the work item is missing', async () => {
      prisma.workItem.findFirst.mockResolvedValue(null);

      await expect(
        service.removeForWorkItem('ws-1', 'proj-1', 'missing', 'c1', AUTHOR.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the comment does not belong to the work item', async () => {
      prisma.workItem.findFirst.mockResolvedValue(WORK_ITEM);
      prisma.comment.findFirst.mockResolvedValue(null);

      await expect(
        service.removeForWorkItem(
          'ws-1',
          'proj-1',
          'wi-1',
          'missing',
          AUTHOR.id,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when called by a non-author', async () => {
      prisma.workItem.findFirst.mockResolvedValue(WORK_ITEM);
      prisma.comment.findFirst.mockResolvedValue({
        id: 'c1',
        authorId: AUTHOR.id,
        mentions: [],
      });

      await expect(
        service.removeForWorkItem(
          'ws-1',
          'proj-1',
          'wi-1',
          'c1',
          'someone-else',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------
  // plainTextPreview() — module-scope helper exercised via activity log
  // metadata passed from create()/update().
  // ---------------------------------------------------------------------

  describe('plainTextPreview() (module-level helper, exercised via activityLog metadata.preview)', () => {
    it('strips a mention span, its data-mention-email attribute, and &nbsp; down to plain text', async () => {
      prisma.workspaceMember.findMany.mockResolvedValue([]);
      txComment.create.mockResolvedValue({
        id: 'c1',
        body: 'irrelevant',
        author: AUTHOR,
        mentions: [],
      });

      await service.create('ws-1', AUTHOR.id, {
        body: '<span data-mention-email="x@y.com">@Jane</span>&nbsp;hi',
      });

      const loggedMetadata = activityLog.log.mock.calls[0][0].metadata;
      expect(loggedMetadata.preview).toBe('@Jane hi');
      expect(loggedMetadata.preview).not.toContain('x@y.com');
      expect(loggedMetadata.preview).not.toContain('<span');
      expect(loggedMetadata.preview).not.toContain('&nbsp;');
    });

    it('collapses repeated whitespace and trims the result', async () => {
      prisma.workspaceMember.findMany.mockResolvedValue([]);
      txComment.create.mockResolvedValue({
        id: 'c1',
        body: 'irrelevant',
        author: AUTHOR,
        mentions: [],
      });

      await service.create('ws-1', AUTHOR.id, {
        body: '  <p>Hello   world</p>  <br/>  again  ',
      });

      const loggedMetadata = activityLog.log.mock.calls[0][0].metadata;
      expect(loggedMetadata.preview).toBe('Hello world again');
    });

    it('truncates to the default 200-character max length', async () => {
      prisma.workspaceMember.findMany.mockResolvedValue([]);
      txComment.create.mockResolvedValue({
        id: 'c1',
        body: 'irrelevant',
        author: AUTHOR,
        mentions: [],
      });

      const longBody = 'a'.repeat(250);
      await service.create('ws-1', AUTHOR.id, { body: longBody });

      const loggedMetadata = activityLog.log.mock.calls[0][0].metadata;
      expect(loggedMetadata.preview).toHaveLength(200);
    });
  });
});
