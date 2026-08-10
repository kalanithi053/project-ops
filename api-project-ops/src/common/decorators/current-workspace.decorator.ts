import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface WorkspaceContext {
  workspaceId: string;
  roleId: string;
  roleName: string;
  /** Workspace-wide dashboard visibility instead of just-your-own-items — see UserRole.isManagerTier. */
  isManagerTier: boolean;
  membershipId: string;
  userId: string;
  ownerId: string;
}

/**
 * Injects the active workspace context established by WorkspaceScopeGuard.
 * Optionally pluck a single field, e.g. `@CurrentWorkspace('workspaceId')`.
 */
export const CurrentWorkspace = createParamDecorator(
  (data: keyof WorkspaceContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const context = request.workspace;
    return data ? context?.[data] : context;
  },
);
