import { Prisma } from '@prisma/client';
import {
  DEFAULT_ROLES,
  PERMISSION_CATALOG,
} from '../common/constants/permissions';
import {
  DEFAULT_MODULES,
  DEFAULT_PRIORITIES,
  DEFAULT_TICKET_STATUSES,
  PLAN_TEMPLATES,
} from '../common/constants/workspace-defaults';

export interface ProvisionedDefaults {
  roleIdsByName: Record<string, string>;
  ownerRoleId: string;
  defaultRoleId: string;
}

/**
 * Seeds a brand-new workspace with its default permission catalog, roles
 * (Owner/Admin/Member/Viewer) + role-permission assignments, modules, ticket
 * statuses and a Free plan. Must run inside a transaction (`tx`).
 *
 * Shared by WorkspacesService.create() and the seed script so both stay in sync.
 */
export async function provisionWorkspaceDefaults(
  tx: Prisma.TransactionClient,
  workspaceId: string,
): Promise<ProvisionedDefaults> {
  // 1. Permission catalog
  await tx.userPermission.createMany({
    data: PERMISSION_CATALOG.map((p) => ({
      workspaceId,
      code: p.code,
      description: p.description,
    })),
    skipDuplicates: true,
  });

  const permissions = await tx.userPermission.findMany({
    where: { workspaceId },
    select: { id: true, code: true },
  });
  const permissionIdByCode = new Map(permissions.map((p) => [p.code, p.id]));

  // 2. Roles + role-permission assignments
  const roleIdsByName: Record<string, string> = {};
  let ownerRoleId = '';
  let defaultRoleId = '';

  for (const roleDef of DEFAULT_ROLES) {
    const role = await tx.userRole.create({
      data: {
        workspaceId,
        name: roleDef.name,
        isDefault: roleDef.isDefault,
        isSystem: roleDef.isSystem,
      },
    });
    roleIdsByName[roleDef.name] = role.id;
    if (roleDef.name === 'Owner') ownerRoleId = role.id;
    if (roleDef.isDefault) defaultRoleId = role.id;

    const links = roleDef.permissions
      .map((code) => permissionIdByCode.get(code))
      .filter((id): id is string => Boolean(id))
      .map((permissionId) => ({ roleId: role.id, permissionId }));

    if (links.length > 0) {
      await tx.rolePermission.createMany({ data: links, skipDuplicates: true });
    }
  }

  // 3. Plan catalog (Professional/Ultimate/Enterprise). Exactly one is active.
  //    Created before modules because each module belongs to a plan.
  await tx.plan.createMany({
    data: PLAN_TEMPLATES.map((plan) => ({
      workspaceId,
      name: plan.name,
      maxProjects: plan.maxProjects,
      maxMembers: plan.maxMembers,
      maxTasksPerModule: plan.maxTasksPerModule,
      features: plan.features as Prisma.InputJsonValue,
      isActive: plan.isActive,
    })),
  });

  const plans = await tx.plan.findMany({
    where: { workspaceId },
    select: { id: true },
  });

  // 4. Modules catalog — the default modules are seeded per plan, so each tier
  //    starts with the same set but can diverge independently.
  await tx.module.createMany({
    data: plans.flatMap((plan) =>
      DEFAULT_MODULES.map((m) => ({
        workspaceId,
        planId: plan.id,
        key: m.key,
        name: m.name,
        defaultTaskLimit: m.defaultTaskLimit,
        isDefault: m.isDefault,
      })),
    ),
    skipDuplicates: true,
  });

  // 5. Ticket statuses
  await tx.ticketStatus.createMany({
    data: DEFAULT_TICKET_STATUSES.map((s) => ({
      workspaceId,
      name: s.name,
      color: s.color,
      order: s.order,
      isDefault: s.isDefault,
      category: s.category,
    })),
    skipDuplicates: true,
  });

  // 6. Priorities
  await tx.priority.createMany({
    data: DEFAULT_PRIORITIES.map((p) => ({
      workspaceId,
      name: p.name,
      color: p.color,
      order: p.order,
      isDefault: p.isDefault,
    })),
    skipDuplicates: true,
  });

  return { roleIdsByName, ownerRoleId, defaultRoleId };
}
