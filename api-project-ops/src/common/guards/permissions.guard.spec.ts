import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PrismaService } from '../../prisma/prisma.service';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let prisma: {
    rolePermission: { findMany: jest.Mock };
    projectMember: { findFirst: jest.Mock };
  };
  let reflector: { getAllAndOverride: jest.Mock };

  const workspaceUserId = 'user-1';
  const workspaceRoleId = 'ws-role-1';
  const projectId = 'proj-1';

  beforeEach(() => {
    prisma = {
      rolePermission: { findMany: jest.fn() },
      projectMember: { findFirst: jest.fn() },
    };
    reflector = { getAllAndOverride: jest.fn() };
    guard = new PermissionsGuard(
      reflector as unknown as Reflector,
      prisma as unknown as PrismaService,
    );
  });

  function contextFor(request: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;
  }

  it('allows the request through when the route requires no permissions', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const request = { workspace: undefined, params: {} };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(prisma.rolePermission.findMany).not.toHaveBeenCalled();
  });

  it('throws when there is no workspace role context', async () => {
    reflector.getAllAndOverride.mockReturnValue(['project.read']);
    const request = { workspace: undefined, params: {} };

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
      ForbiddenException,
    );
  });

  describe('workspace-scoped routes (no :projectId param)', () => {
    it('grants access using the caller workspace role permissions', async () => {
      reflector.getAllAndOverride.mockReturnValue(['project.create']);
      prisma.rolePermission.findMany.mockResolvedValue([
        { permission: { code: 'project.create' } },
      ]);
      const request = {
        workspace: { roleId: workspaceRoleId, userId: workspaceUserId },
        params: {},
      };

      await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
      expect(prisma.rolePermission.findMany).toHaveBeenCalledWith({
        where: { roleId: workspaceRoleId },
        select: { permission: { select: { code: true } } },
      });
      expect(prisma.projectMember.findFirst).not.toHaveBeenCalled();
    });

    it('denies access when the workspace role lacks the permission', async () => {
      reflector.getAllAndOverride.mockReturnValue(['project.create']);
      prisma.rolePermission.findMany.mockResolvedValue([]);
      const request = {
        workspace: { roleId: workspaceRoleId, userId: workspaceUserId },
        params: {},
      };

      await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('project-scoped routes (:projectId param present)', () => {
    it('grants access using the caller ProjectMember role, ignoring the workspace role', async () => {
      reflector.getAllAndOverride.mockReturnValue(['member.invite']);
      prisma.projectMember.findFirst.mockResolvedValue({
        roleId: 'project-role-1',
      });
      prisma.rolePermission.findMany.mockResolvedValue([
        { permission: { code: 'member.invite' } },
      ]);
      const request = {
        workspace: { roleId: workspaceRoleId, userId: workspaceUserId },
        params: { projectId },
      };

      await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
      expect(prisma.projectMember.findFirst).toHaveBeenCalledWith({
        where: {
          projectId,
          userId: workspaceUserId,
          status: { not: 'removed' },
        },
        select: { roleId: true },
      });
      expect(prisma.rolePermission.findMany).toHaveBeenCalledWith({
        where: { roleId: 'project-role-1' },
        select: { permission: { select: { code: true } } },
      });
    });

    it('denies access when the caller holds the permission workspace-wide but is not a member of this project', async () => {
      reflector.getAllAndOverride.mockReturnValue(['member.invite']);
      prisma.projectMember.findFirst.mockResolvedValue(null);
      const request = {
        workspace: { roleId: workspaceRoleId, userId: workspaceUserId },
        params: { projectId },
      };

      await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.rolePermission.findMany).not.toHaveBeenCalled();
    });

    it('denies access when the project role lacks the required permission', async () => {
      reflector.getAllAndOverride.mockReturnValue(['member.invite']);
      prisma.projectMember.findFirst.mockResolvedValue({
        roleId: 'project-role-1',
      });
      prisma.rolePermission.findMany.mockResolvedValue([
        { permission: { code: 'project.read' } },
      ]);
      const request = {
        workspace: { roleId: workspaceRoleId, userId: workspaceUserId },
        params: { projectId },
      };

      await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
