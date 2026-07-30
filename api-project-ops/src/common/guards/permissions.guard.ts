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
 * The resolved permission set is cached on the request to avoid re-querying.
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

    const codes = await this.resolvePermissionCodes(request, workspace.roleId);

    const missing = required.filter((code) => !codes.has(code));
    if (missing.length > 0) {
      throw new ForbiddenException(
        `Missing required permission(s): ${missing.join(', ')}`,
      );
    }

    return true;
  }

  private async resolvePermissionCodes(
    request: Request,
    roleId: string,
  ): Promise<Set<string>> {
    if (request.__permissionCodes) {
      return request.__permissionCodes;
    }

    const rows = await this.prisma.rolePermission.findMany({
      where: { roleId },
      select: { permission: { select: { code: true } } },
    });

    const codes = new Set(rows.map((r) => r.permission.code));
    request.__permissionCodes = codes;
    return codes;
  }
}
