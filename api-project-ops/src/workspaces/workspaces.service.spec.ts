import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WorkspacesService } from './workspaces.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { provisionWorkspaceDefaults } from './workspace-provisioning';

jest.mock('./workspace-provisioning', () => ({
  provisionWorkspaceDefaults: jest.fn(),
}));

describe('WorkspacesService', () => {
  let service: WorkspacesService;
  let prisma: {
    workspace: { findFirst: jest.Mock };
    workspaceMember: { findFirst: jest.Mock; findMany: jest.Mock; create: jest.Mock };
    $transaction: jest.Mock;
  };

  const mockProvision = provisionWorkspaceDefaults as jest.Mock;

  beforeEach(async () => {
    prisma = {
      workspace: { findFirst: jest.fn() },
      workspaceMember: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<WorkspacesService>(WorkspacesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto: CreateWorkspaceDto = { name: 'Acme Inc', slug: 'acme' };

    it('throws BadRequestException when the slug is already taken', async () => {
      prisma.workspace.findFirst.mockResolvedValue({ id: 'existing-ws' });

      await expect(service.create('user-1', dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates the workspace, provisions defaults, and adds the creator as owner', async () => {
      prisma.workspace.findFirst.mockResolvedValue(null);

      const tx = {
        workspace: {
          create: jest.fn().mockResolvedValue({
            id: 'ws-1',
            name: 'Acme Inc',
            slug: 'acme',
            ownerId: 'user-1',
          }),
        },
        workspaceMember: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'member-1' }),
        },
      };
      mockProvision.mockResolvedValue({
        roleIdsByName: { Owner: 'role-owner' },
        ownerRoleId: 'role-owner',
        defaultRoleId: 'role-owner',
      });
      prisma.$transaction.mockImplementation((cb) => cb(tx));

      const result = await service.create('user-1', dto);

      expect(tx.workspace.create).toHaveBeenCalledWith({
        data: { name: 'Acme Inc', slug: 'acme', ownerId: 'user-1' },
      });
      expect(mockProvision).toHaveBeenCalledWith(tx, 'ws-1');
      expect(tx.workspaceMember.create).toHaveBeenCalledWith({
        data: {
          workspaceId: 'ws-1',
          userId: 'user-1',
          roleId: 'role-owner',
          status: 'active',
          isDefault: true,
        },
      });
      expect(result).toEqual({
        id: 'ws-1',
        name: 'Acme Inc',
        slug: 'acme',
        ownerId: 'user-1',
      });
    });

    it('marks the new membership as non-default when the user already belongs to a workspace', async () => {
      prisma.workspace.findFirst.mockResolvedValue(null);

      const tx = {
        workspace: {
          create: jest.fn().mockResolvedValue({ id: 'ws-2' }),
        },
        workspaceMember: {
          findFirst: jest.fn().mockResolvedValue({ id: 'other-membership' }),
          create: jest.fn().mockResolvedValue({ id: 'member-2' }),
        },
      };
      mockProvision.mockResolvedValue({
        roleIdsByName: { Owner: 'role-owner' },
        ownerRoleId: 'role-owner',
        defaultRoleId: 'role-owner',
      });
      prisma.$transaction.mockImplementation((cb) => cb(tx));

      await service.create('user-1', { name: 'Second Workspace' });

      expect(tx.workspaceMember.create).toHaveBeenCalledWith({
        data: {
          workspaceId: 'ws-2',
          userId: 'user-1',
          roleId: 'role-owner',
          status: 'active',
          isDefault: false,
        },
      });
    });

    it('allows workspace creation without a slug (no uniqueness check performed)', async () => {
      const tx = {
        workspace: {
          create: jest.fn().mockResolvedValue({ id: 'ws-3' }),
        },
        workspaceMember: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'member-3' }),
        },
      };
      mockProvision.mockResolvedValue({
        roleIdsByName: {},
        ownerRoleId: 'role-owner',
        defaultRoleId: 'role-owner',
      });
      prisma.$transaction.mockImplementation((cb) => cb(tx));

      await service.create('user-1', { name: 'No Slug Workspace' });

      expect(prisma.workspace.findFirst).not.toHaveBeenCalled();
      expect(tx.workspace.create).toHaveBeenCalledWith({
        data: { name: 'No Slug Workspace', slug: undefined, ownerId: 'user-1' },
      });
    });
  });

  describe('listForUser', () => {
    it('maps memberships to the workspace summary shape', async () => {
      const joinedAt = new Date('2024-01-01');
      prisma.workspaceMember.findMany.mockResolvedValue([
        {
          status: 'active',
          isDefault: true,
          joinedAt,
          workspace: { id: 'ws-1', name: 'Acme Inc', slug: 'acme' },
          role: { id: 'role-1', name: 'Owner' },
        },
      ]);

      const result = await service.listForUser('user-1');

      expect(prisma.workspaceMember.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: { not: 'removed' } },
        include: {
          workspace: true,
          role: { select: { id: true, name: true } },
        },
        orderBy: { joinedAt: 'asc' },
      });
      expect(result).toEqual([
        {
          id: 'ws-1',
          name: 'Acme Inc',
          slug: 'acme',
          status: 'active',
          role: { id: 'role-1', name: 'Owner' },
          isDefault: true,
          joinedAt,
        },
      ]);
    });

    it('returns an empty array when the user has no memberships', async () => {
      prisma.workspaceMember.findMany.mockResolvedValue([]);

      const result = await service.listForUser('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('findOneForUser', () => {
    it('returns the workspace enriched with the caller role when membership exists', async () => {
      prisma.workspaceMember.findFirst.mockResolvedValue({
        isDefault: true,
        workspace: { id: 'ws-1', name: 'Acme Inc', slug: 'acme' },
        role: { id: 'role-1', name: 'Owner' },
      });

      const result = await service.findOneForUser('user-1', 'ws-1');

      expect(prisma.workspaceMember.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', workspaceId: 'ws-1', status: { not: 'removed' } },
        include: { workspace: true, role: true },
      });
      expect(result).toEqual({
        id: 'ws-1',
        name: 'Acme Inc',
        slug: 'acme',
        role: { id: 'role-1', name: 'Owner' },
        isDefault: true,
      });
    });

    it('throws NotFoundException when there is no membership for the workspace', async () => {
      prisma.workspaceMember.findFirst.mockResolvedValue(null);

      await expect(
        service.findOneForUser('user-1', 'ws-missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
