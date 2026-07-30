import { AuthenticatedUser } from './jwt-payload';
import { WorkspaceContext } from '../decorators/current-workspace.decorator';

declare global {
  namespace Express {
    // `Request.user` is already declared (as `User | undefined`) by
    // @types/passport; extend `User` itself instead of redeclaring `user`,
    // which would conflict with that declaration.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends AuthenticatedUser {}

    interface Request {
      workspace?: WorkspaceContext;
      __permissionCodes?: Set<string>;
    }
  }
}
