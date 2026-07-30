import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RolesService', () => {
  let service: RolesService;
  let prisma: any;

  const workspaceId = 'ws-1';
  const roleId = 'role-1';

  const mockPrismaService = {
    userRole: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    userPermission: {
      findMany: jest.fn(),
    },
    rolePermission: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    workspaceMember: {
      count: jest.fn(),
    },
    projectMember: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Run the transaction callback against the same mocked client so nested
    // tx.* calls hit the same jest.fn()s asserted on below.
    mockPrismaService.$transaction.mockImplementation((cb: any) =>
      cb(mockPrismaService),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('list', () => {
    it('returns roles mapped with flattened permission codes', async () => {
      mockPrismaService.userRole.findMany.mockResolvedValue([
        {
          id: roleId,
          name: 'Admin',
          isDefault: true,
          isSystem: true,
          rolePermissions: [
            { permission: { code: 'project.create' } },
            { permission: { code: 'task.create' } },
          ],
        },
      ]);

      const result = await service.list(workspaceId);

      expect(prisma.userRole.findMany).toHaveBeenCalledWith({
        where: { workspaceId },
        include: {
          rolePermissions: {
            include: { permission: { select: { code: true } } },
          },
        },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual([
        {
          id: roleId,
          name: 'Admin',
          isDefault: true,
          isSystem: true,
          permissions: ['project.create', 'task.create'],
        },
      ]);
    });

    it('returns an empty array when the workspace has no roles', async () => {
      mockPrismaService.userRole.findMany.mockResolvedValue([]);

      const result = await service.list(workspaceId);

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('creates a role and assigns resolved permission ids', async () => {
      mockPrismaService.userRole.findFirst.mockResolvedValue(null); // name free
      mockPrismaService.userPermission.findMany.mockResolvedValue([
        { id: 'perm-1', code: 'project.create' },
      ]);
      mockPrismaService.userRole.create.mockResolvedValue({
        id: roleId,
        workspaceId,
        name: 'Project Lead',
        isDefault: false,
      });
      mockPrismaService.rolePermission.createMany.mockResolvedValue({
        count: 1,
      });

      const dto = { name: 'Project Lead', permissionCodes: ['project.create'] };
      const result = await service.create(workspaceId, dto);

      expect(prisma.userRole.create).toHaveBeenCalledWith({
        data: { workspaceId, name: 'Project Lead', isDefault: false },
      });
      expect(prisma.rolePermission.createMany).toHaveBeenCalledWith({
        data: [{ roleId, permissionId: 'perm-1' }],
      });
      expect(result).toEqual({
        id: roleId,
        workspaceId,
        name: 'Project Lead',
        isDefault: false,
      });
    });

    it('clears the previous default role when creating a default role', async () => {
      mockPrismaService.userRole.findFirst.mockResolvedValue(null);
      mockPrismaService.userPermission.findMany.mockResolvedValue([]);
      mockPrismaService.userRole.create.mockResolvedValue({
        id: roleId,
        workspaceId,
        name: 'Member',
        isDefault: true,
      });

      await service.create(workspaceId, {
        name: 'Member',
        isDefault: true,
      });

      expect(prisma.userRole.updateMany).toHaveBeenCalledWith({
        where: { workspaceId, isDefault: true },
        data: { isDefault: false },
      });
    });

    it('does not create rolePermission rows when no permission codes resolve', async () => {
      mockPrismaService.userRole.findFirst.mockResolvedValue(null);
      mockPrismaService.userRole.create.mockResolvedValue({
        id: roleId,
        workspaceId,
        name: 'Viewer',
        isDefault: false,
      });

      await service.create(workspaceId, { name: 'Viewer' });

      expect(prisma.userPermission.findMany).not.toHaveBeenCalled();
      expect(prisma.rolePermission.createMany).not.toHaveBeenCalled();
    });

    it('throws ConflictException when a role with that name already exists', async () => {
      mockPrismaService.userRole.findFirst.mockResolvedValue({
        id: 'other-role',
        name: 'Project Lead',
      });

      await expect(
        service.create(workspaceId, { name: 'Project Lead' } as any),
      ).rejects.toThrow(ConflictException);
      expect(prisma.userRole.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when a permission code is unknown', async () => {
      mockPrismaService.userRole.findFirst.mockResolvedValue(null);
      mockPrismaService.userPermission.findMany.mockResolvedValue([]);

      await expect(
        service.create(workspaceId, {
          name: 'Project Lead',
          permissionCodes: ['bogus.code'],
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.userRole.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates a role name and replaces its permissions', async () => {
      mockPrismaService.userRole.findFirst
        .mockResolvedValueOnce({
          id: roleId,
          workspaceId,
          name: 'Old Name',
          isSystem: false,
        }) // getOwned
        .mockResolvedValueOnce(null); // assertNameFree
      mockPrismaService.userPermission.findMany.mockResolvedValue([
        { id: 'perm-2', code: 'task.create' },
      ]);
      mockPrismaService.userRole.update.mockResolvedValue({
        id: roleId,
        name: 'New Name',
      });

      const result = await service.update(workspaceId, roleId, {
        name: 'New Name',
        permissionCodes: ['task.create'],
      });

      expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({
        where: { roleId },
      });
      expect(prisma.rolePermission.createMany).toHaveBeenCalledWith({
        data: [{ roleId, permissionId: 'perm-2' }],
      });
      expect(prisma.userRole.update).toHaveBeenCalledWith({
        where: { id: roleId },
        data: { name: 'New Name', isDefault: undefined },
      });
      expect(result).toEqual({ id: roleId, name: 'New Name' });
    });

    it('deletes existing permissions without recreating any when permissionCodes resolves empty', async () => {
      mockPrismaService.userRole.findFirst.mockResolvedValueOnce({
        id: roleId,
        workspaceId,
        name: 'Same Name',
        isSystem: false,
      });
      mockPrismaService.userRole.update.mockResolvedValue({ id: roleId });

      await service.update(workspaceId, roleId, {
        permissionCodes: [],
      });

      expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({
        where: { roleId },
      });
      expect(prisma.rolePermission.createMany).not.toHaveBeenCalled();
    });

    it('does not touch permissions when permissionCodes is undefined', async () => {
      mockPrismaService.userRole.findFirst.mockResolvedValueOnce({
        id: roleId,
        workspaceId,
        name: 'Same Name',
        isSystem: false,
      });
      mockPrismaService.userRole.update.mockResolvedValue({ id: roleId });

      await service.update(workspaceId, roleId, { name: 'Same Name' });

      expect(prisma.rolePermission.deleteMany).not.toHaveBeenCalled();
      expect(prisma.rolePermission.createMany).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the role does not belong to the workspace', async () => {
      mockPrismaService.userRole.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.update(workspaceId, roleId, { name: 'New Name' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when renaming to a name already used by another role', async () => {
      mockPrismaService.userRole.findFirst
        .mockResolvedValueOnce({
          id: roleId,
          workspaceId,
          name: 'Old Name',
          isSystem: false,
        })
        .mockResolvedValueOnce({ id: 'other-role', name: 'Taken Name' });

      await expect(
        service.update(workspaceId, roleId, { name: 'Taken Name' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('deletes a role that is not in use and not a system role', async () => {
      mockPrismaService.userRole.findFirst.mockResolvedValue({
        id: roleId,
        workspaceId,
        isSystem: false,
      });
      mockPrismaService.workspaceMember.count.mockResolvedValue(0);
      mockPrismaService.projectMember.count.mockResolvedValue(0);
      mockPrismaService.userRole.delete.mockResolvedValue({ id: roleId });

      const result = await service.remove(workspaceId, roleId);

      expect(prisma.userRole.delete).toHaveBeenCalledWith({
        where: { id: roleId },
      });
      expect(result).toEqual({ id: roleId, deleted: true });
    });

    it('throws NotFoundException when the role does not exist in the workspace', async () => {
      mockPrismaService.userRole.findFirst.mockResolvedValue(null);

      await expect(service.remove(workspaceId, roleId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when the role is a system role', async () => {
      mockPrismaService.userRole.findFirst.mockResolvedValue({
        id: roleId,
        workspaceId,
        isSystem: true,
      });

      await expect(service.remove(workspaceId, roleId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.userRole.delete).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the role is still assigned to workspace or project members', async () => {
      mockPrismaService.userRole.findFirst.mockResolvedValue({
        id: roleId,
        workspaceId,
        isSystem: false,
      });
      mockPrismaService.workspaceMember.count.mockResolvedValue(1);
      mockPrismaService.projectMember.count.mockResolvedValue(0);

      await expect(service.remove(workspaceId, roleId)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.userRole.delete).not.toHaveBeenCalled();
    });
  });
});
