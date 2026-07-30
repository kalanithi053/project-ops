import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { WorkspaceOwnerGuard } from './workspace-owner.guard';

describe('WorkspaceOwnerGuard', () => {
  const guard = new WorkspaceOwnerGuard();

  function contextFor(request: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  it('allows the request when the caller is the workspace owner', () => {
    const request = { workspace: { userId: 'user-1', ownerId: 'user-1' } };
    expect(guard.canActivate(contextFor(request))).toBe(true);
  });

  it('denies the request when the caller is not the workspace owner, even with the manage permission', () => {
    const request = { workspace: { userId: 'user-2', ownerId: 'user-1' } };
    expect(() => guard.canActivate(contextFor(request))).toThrow(
      ForbiddenException,
    );
  });
});
