import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Restricts a route to the workspace's owner (Workspace.ownerId), independent
 * of role/permission assignments — a role can be re-granted WORKSPACE_MANAGE,
 * but only the owner may act here. Must run after WorkspaceScopeGuard.
 */
@Injectable()
export class WorkspaceOwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const workspace = request.workspace;

    if (!workspace) {
      throw new UnauthorizedException('Missing workspace context.');
    }

    if (workspace.userId !== workspace.ownerId) {
      throw new ForbiddenException(
        'Only the workspace owner can perform this action.',
      );
    }

    return true;
  }
}
