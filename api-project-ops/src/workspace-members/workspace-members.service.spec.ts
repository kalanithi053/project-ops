import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceMembersService } from './workspace-members.service';
import { PrismaService } from '../prisma/prisma.service';
import { InviteWorkspaceMemberDto } from './dto/invite-workspace-member.dto';
import { UpdateWorkspaceMemberDto } from './dto/update-workspace-member.dto';

describe('WorkspaceMembersService', () => {
  let service: WorkspaceMembersService;
  let prisma: {
    workspaceMember: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    user: { upsert: jest.Mock };
    userRole: { findFirst: jest.Mock };
    workspace: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      workspaceMember: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      user: { upsert: jest.fn() },
      userRole: { findFirst: jest.fn() },
      workspace: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceMembersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<WorkspaceMembersService>(WorkspaceMembersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('returns members of the workspace with user and role included', async () => {
      const members = [
        {
          id: 'member-1',
          user: {
            id: 'user-1',
            email: 'jane@acme.com',
            firstName: 'Jane',
            lastName: 'Doe',
          },
          role: { id: 'role-1', name: 'Owner' },
        },
      ];
      prisma.workspaceMember.findMany.mockResolvedValue(members);

      const result = await service.list('ws-1');

      expect(prisma.workspaceMember.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1' },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          role: { select: { id: true, name: true } },
        },
        orderBy: { joinedAt: 'asc' },
      });
      expect(result).toEqual(members);
    });
  });

  describe('invite', () => {
    const dto: InviteWorkspaceMemberDto = { email: 'john@acme.com' };

    it('throws BadRequestException when no roleId is given and the workspace has no default role', async () => {
      prisma.userRole.findFirst.mockResolvedValue(null);

      await expect(service.invite('ws-1', dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.user.upsert).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when an explicit roleId does not belong to the workspace', async () => {
      prisma.userRole.findFirst.mockResolvedValue(null);

      await expect(
        service.invite('ws-1', { email: 'john@acme.com', roleId: 'bad-role' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.userRole.findFirst).toHaveBeenCalledWith({
        where: { id: 'bad-role', workspaceId: 'ws-1' },
      });
    });

    it('throws ConflictException when the user is already an active member', async () => {
      prisma.userRole.findFirst.mockResolvedValue({ id: 'role-default' });
      prisma.user.upsert.mockResolvedValue({
        id: 'user-1',
        email: 'john@acme.com',
      });
      prisma.workspaceMember.findUnique.mockResolvedValue({
        id: 'member-1',
        status: 'active',
      });

      await expect(service.invite('ws-1', dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates a new membership for a brand-new (or never-a-member) user', async () => {
      prisma.userRole.findFirst.mockResolvedValue({ id: 'role-default' });
      prisma.user.upsert.mockResolvedValue({
        id: 'user-1',
        email: 'john@acme.com',
      });
      prisma.workspaceMember.findUnique.mockResolvedValue(null);
      const created = {
        id: 'member-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        status: 'active',
      };
      prisma.workspaceMember.create.mockResolvedValue(created);

      const result = await service.invite('ws-1', dto);

      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { email: 'john@acme.com' },
        update: {},
        create: { email: 'john@acme.com' },
      });
      expect(prisma.workspaceMember.create).toHaveBeenCalledWith({
        data: {
          workspaceId: 'ws-1',
          userId: 'user-1',
          roleId: 'role-default',
          status: 'active',
        },
        include: {
          user: { select: { id: true, email: true } },
          role: { select: { id: true, name: true } },
        },
      });
      expect(result).toEqual(created);
    });

    it('re-activates a previously removed membership instead of creating a new one', async () => {
      prisma.userRole.findFirst.mockResolvedValue({ id: 'role-default' });
      prisma.user.upsert.mockResolvedValue({
        id: 'user-1',
        email: 'john@acme.com',
      });
      prisma.workspaceMember.findUnique.mockResolvedValue({
        id: 'member-old',
        status: 'removed',
      });
      const updated = {
        id: 'member-old',
        status: 'active',
        roleId: 'role-default',
      };
      prisma.workspaceMember.update.mockResolvedValue(updated);

      const result = await service.invite('ws-1', dto);

      expect(prisma.workspaceMember.update).toHaveBeenCalledWith({
        where: { id: 'member-old' },
        data: { status: 'active', roleId: 'role-default' },
      });
      expect(prisma.workspaceMember.create).not.toHaveBeenCalled();
      expect(result).toEqual(updated);
    });

    it('resolves an explicit roleId when it belongs to the workspace', async () => {
      prisma.userRole.findFirst.mockResolvedValue({ id: 'role-explicit' });
      prisma.user.upsert.mockResolvedValue({
        id: 'user-1',
        email: 'john@acme.com',
      });
      prisma.workspaceMember.findUnique.mockResolvedValue(null);
      prisma.workspaceMember.create.mockResolvedValue({ id: 'member-1' });

      await service.invite('ws-1', {
        email: 'john@acme.com',
        roleId: 'role-explicit',
      });

      expect(prisma.userRole.findFirst).toHaveBeenCalledWith({
        where: { id: 'role-explicit', workspaceId: 'ws-1' },
      });
      expect(prisma.workspaceMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ roleId: 'role-explicit' }),
        }),
      );
    });
  });

  describe('update', () => {
    const dto: UpdateWorkspaceMemberDto = { roleId: 'role-2' };

    it('throws NotFoundException when the member does not exist in the workspace', async () => {
      prisma.workspaceMember.findFirst.mockResolvedValue(null);

      await expect(
        service.update('ws-1', 'member-missing', dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the new roleId does not belong to the workspace', async () => {
      prisma.workspaceMember.findFirst.mockResolvedValue({
        id: 'member-1',
        userId: 'user-1',
      });
      prisma.userRole.findFirst.mockResolvedValue(null);

      await expect(service.update('ws-1', 'member-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when trying to remove the workspace owner', async () => {
      prisma.workspaceMember.findFirst.mockResolvedValue({
        id: 'member-1',
        userId: 'owner-user',
      });
      prisma.workspace.findUnique.mockResolvedValue({ ownerId: 'owner-user' });

      await expect(
        service.update('ws-1', 'member-1', { status: 'removed' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates the role and status for a valid member', async () => {
      prisma.workspaceMember.findFirst.mockResolvedValue({
        id: 'member-1',
        userId: 'user-1',
      });
      prisma.userRole.findFirst.mockResolvedValue({ id: 'role-2' });
      const updated = { id: 'member-1', roleId: 'role-2', status: 'active' };
      prisma.workspaceMember.update.mockResolvedValue(updated);

      const result = await service.update('ws-1', 'member-1', {
        roleId: 'role-2',
        status: 'active',
      });

      expect(prisma.workspaceMember.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: { roleId: 'role-2', status: 'active' },
      });
      expect(result).toEqual(updated);
    });

    it('allows removing a non-owner member', async () => {
      prisma.workspaceMember.findFirst.mockResolvedValue({
        id: 'member-1',
        userId: 'user-1',
      });
      prisma.workspace.findUnique.mockResolvedValue({
        ownerId: 'someone-else',
      });
      const updated = { id: 'member-1', status: 'removed' };
      prisma.workspaceMember.update.mockResolvedValue(updated);

      const result = await service.update('ws-1', 'member-1', {
        status: 'removed',
      });

      expect(result).toEqual(updated);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the member does not exist', async () => {
      prisma.workspaceMember.findFirst.mockResolvedValue(null);

      await expect(service.remove('ws-1', 'member-missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when trying to remove the workspace owner', async () => {
      prisma.workspaceMember.findFirst.mockResolvedValue({
        id: 'member-1',
        userId: 'owner-user',
      });
      prisma.workspace.findUnique.mockResolvedValue({ ownerId: 'owner-user' });

      await expect(service.remove('ws-1', 'member-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('marks a non-owner member as removed', async () => {
      prisma.workspaceMember.findFirst.mockResolvedValue({
        id: 'member-1',
        userId: 'user-1',
      });
      prisma.workspace.findUnique.mockResolvedValue({
        ownerId: 'someone-else',
      });
      prisma.workspaceMember.update.mockResolvedValue({});

      const result = await service.remove('ws-1', 'member-1');

      expect(prisma.workspaceMember.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: { status: 'removed' },
      });
      expect(result).toEqual({ id: 'member-1', removed: true });
    });
  });

  describe('setDefault', () => {
    it('throws NotFoundException when the user has no active membership in the workspace', async () => {
      prisma.workspaceMember.findFirst.mockResolvedValue(null);

      await expect(service.setDefault('user-1', 'ws-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('clears the previous default and sets the new one inside a transaction', async () => {
      prisma.workspaceMember.findFirst.mockResolvedValue({
        id: 'member-1',
        userId: 'user-1',
        workspaceId: 'ws-1',
      });

      const tx = {
        workspaceMember: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          update: jest.fn().mockResolvedValue({
            id: 'member-1',
            isDefault: true,
            workspace: { id: 'ws-1', name: 'Acme Inc' },
          }),
        },
      };
      prisma.$transaction.mockImplementation((cb) => cb(tx));

      const result = await service.setDefault('user-1', 'ws-1');

      expect(tx.workspaceMember.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isDefault: true },
        data: { isDefault: false },
      });
      expect(tx.workspaceMember.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: { isDefault: true },
        include: { workspace: true },
      });
      expect(result).toEqual({
        id: 'member-1',
        isDefault: true,
        workspace: { id: 'ws-1', name: 'Acme Inc' },
      });
    });
  });
});
