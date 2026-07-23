import { SetMetadata } from '@nestjs/common';
import { PermissionCode } from '../constants/permissions';

export const PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Declares the permission code(s) a route requires. Enforced by PermissionsGuard.
 * Multiple codes are ANDed (the caller must hold all of them).
 */
export const RequirePermission = (...permissions: PermissionCode[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
