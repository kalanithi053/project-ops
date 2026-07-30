import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AccessService } from './access.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AccessService', () => {
  let service: AccessService;
  let prisma: any;

  const workspaceId = 'ws-1';
  const projectId = 'proj-1';
  const userId = 'user-1';
  const roleId = 'role-1';

  const mockPrismaService = {
    userRole: {
      findUnique: jest.fn(),
    },
    project: {
      findFirst: jest.fn(),
    },
    projectMember: {
      findFirst: jest.fn(),
    },
    rolePermission: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AccessService>(AccessService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('workspacePermissions', () => {
    it('returns the workspace scope permission report for the given role', async () => {
      mockPrismaService.userRole.findUnique.mockResolvedValue({
        id: roleId,
        name: 'Admin',
      });
      mockPrismaService.rolePermission.findMany.mockResolvedValue([
        { permission: { code: 'project.create' } },
        { permission: { code: 'task.create' } },
      ]);

      const result = await service.workspacePermissions(workspaceId, roleId);

      expect(prisma.userRole.findUnique).toHaveBeenCalledWith({
        where: { id: roleId },
        select: { id: true, name: true },
      });
      expect(result).toEqual({
        scope: 'workspace',
        workspaceId,
        role: { id: roleId, name: 'Admin' },
        permissions: ['project.create', 'task.create'],
      });
    });

    it('returns a null role and still resolves permissions when the role no longer exists', async () => {
      mockPrismaService.userRole.findUnique.mockResolvedValue(null);
      mockPrismaService.rolePermission.findMany.mockResolvedValue([]);

      const result = await service.workspacePermissions(workspaceId, roleId);

      expect(result).toEqual({
        scope: 'workspace',
        workspaceId,
        role: null,
        permissions: [],
      });
    });
  });

  describe('projectPermissions', () => {
    it('returns the member role and sorted permission codes when the caller is a project member', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({ id: projectId });
      mockPrismaService.projectMember.findFirst.mockResolvedValue({
        roleId,
        role: { id: roleId, name: 'Contributor' },
      });
      mockPrismaService.rolePermission.findMany.mockResolvedValue([
        { permission: { code: 'task.create' } },
        { permission: { code: 'comment.create' } },
      ]);

      const result = await service.projectPermissions(
        workspaceId,
        projectId,
        userId,
      );

      expect(prisma.project.findFirst).toHaveBeenCalledWith({
        where: { id: projectId, workspaceId, deletedAt: null },
        select: { id: true },
      });
      expect(prisma.projectMember.findFirst).toHaveBeenCalledWith({
        where: { projectId, userId, status: { not: 'removed' } },
        include: { role: { select: { id: true, name: true } } },
      });
      expect(result).toEqual({
        scope: 'project',
        projectId,
        isMember: true,
        role: { id: roleId, name: 'Contributor' },
        permissions: ['comment.create', 'task.create'],
      });
    });

    it('returns isMember false with no permissions when the caller has no project membership', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({ id: projectId });
      mockPrismaService.projectMember.findFirst.mockResolvedValue(null);

      const result = await service.projectPermissions(
        workspaceId,
        projectId,
        userId,
      );

      expect(result).toEqual({
        scope: 'project',
        projectId,
        isMember: false,
        role: null,
        permissions: [],
      });
      expect(prisma.rolePermission.findMany).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the project does not exist in the workspace', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.projectPermissions(workspaceId, projectId, userId),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.projectMember.findFirst).not.toHaveBeenCalled();
    });
  });
});
