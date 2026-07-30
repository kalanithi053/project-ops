import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { PermissionCode } from '../constants/permissions';

/**
 * Enforces @RequirePermission(...) codes against the active role's permission
 * set. Must run after WorkspaceScopeGuard (needs request.workspace.roleId).
 *
 * Routes nested under a `:projectId` param are checked against the caller's
 * ProjectMember role for that project instead of their workspace role —
 * project access is separate from workspace access, so a workspace-level
 * permission (e.g. an Admin's `member.invite`) must not authorize action on
 * a project the caller isn't actually a member of. Routes with no `:projectId`
 * (creating a project, workspace-wide catalogs/settings) keep using the
 * workspace role. The resolved permission set is cached on the request to
 * avoid re-querying.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionCode[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const workspace = request.workspace;

    if (!workspace?.roleId) {
      throw new ForbiddenException('Missing workspace role context.');
    }

    const rawProjectId = request.params?.projectId;
    const projectId = Array.isArray(rawProjectId)
      ? rawProjectId[0]
      : rawProjectId;
    const codes = projectId
      ? await this.resolveProjectPermissionCodes(
          request,
          projectId,
          workspace.userId,
        )
      : await this.resolveWorkspacePermissionCodes(request, workspace.roleId);

    const missing = required.filter((code) => !codes.has(code));
    if (missing.length > 0) {
      throw new ForbiddenException(
        `Missing required permission(s): ${missing.join(', ')}`,
      );
    }

    return true;
  }

  private async resolveWorkspacePermissionCodes(
    request: Request,
    roleId: string,
  ): Promise<Set<string>> {
    if (request.__permissionCodes) {
      return request.__permissionCodes;
    }

    const codes = await this.permissionCodesForRole(roleId);
    request.__permissionCodes = codes;
    return codes;
  }

  private async resolveProjectPermissionCodes(
    request: Request,
    projectId: string,
    userId: string,
  ): Promise<Set<string>> {
    if (request.__projectPermissionCodes?.projectId === projectId) {
      return request.__projectPermissionCodes.codes;
    }

    const membership = await this.prisma.projectMember.findFirst({
      where: { projectId, userId, status: { not: 'removed' } },
      select: { roleId: true },
    });

    const codes = membership
      ? await this.permissionCodesForRole(membership.roleId)
      : new Set<string>();

    request.__projectPermissionCodes = { projectId, codes };
    return codes;
  }

  private async permissionCodesForRole(roleId: string): Promise<Set<string>> {
    const rows = await this.prisma.rolePermission.findMany({
      where: { roleId },
      select: { permission: { select: { code: true } } },
    });
    return new Set(rows.map((r) => r.permission.code));
  }
}
