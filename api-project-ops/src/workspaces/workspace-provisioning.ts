import { Prisma } from '@prisma/client';
import {
  DEFAULT_ROLES,
  PERMISSION_CATALOG,
} from '../common/constants/permissions';
import {
  DEFAULT_HUBS,
  DEFAULT_MODULES,
  DEFAULT_PRIORITIES,
  DEFAULT_PROJECT_TYPES,
  DEFAULT_TICKET_STATUSES,
  DEFAULT_WORK_TYPES,
  HUB_TIERS,
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
 * statuses, priorities, work types and a Free plan. Must run inside a
 * transaction (`tx`).
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

  // 3. Project types. Created before plans because every plan belongs to one.
  await tx.projectType.createMany({
    data: DEFAULT_PROJECT_TYPES.map((t) => ({
      workspaceId,
      name: t.name,
      description: t.description,
      isPlanAdd: t.isPlanAdd,
      color: t.color,
    })),
    skipDuplicates: true,
  });

  const projectTypes = await tx.projectType.findMany({
    where: { workspaceId },
    select: { id: true, isPlanAdd: true },
  });
  // Seeded plans belong to the first plan-adding project type.
  const planProjectTypeId =
    projectTypes.find((t) => t.isPlanAdd)?.id ?? projectTypes[0]?.id;

  // 4. Plan catalog (Professional/Ultimate/Enterprise). Exactly one is active.
  await tx.plan.createMany({
    data: PLAN_TEMPLATES.map((plan) => ({
      workspaceId,
      projectTypeId: planProjectTypeId,
      name: plan.name,
      features: plan.features as Prisma.InputJsonValue,
      isActive: plan.isActive,
    })),
  });

  const plans = await tx.plan.findMany({
    where: { workspaceId },
    select: { id: true },
  });

  // 4.5. HubSpot Hub catalog (Marketing/Sales/Service/Content/Operations/
  //      Commerce Hub), each with its own Starter/Professional/Enterprise
  //      tiers — only meaningful under the plan-adding project type.
  if (planProjectTypeId) {
    await provisionHubCatalog(tx, workspaceId, planProjectTypeId);
  }

  // 5. Modules catalog — the default modules are seeded per plan, so each tier
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

  // 6. Ticket statuses
  await tx.ticketStatus.createMany({
    data: DEFAULT_TICKET_STATUSES.map((s) => ({
      workspaceId,
      name: s.name,
      color: s.color,
      order: s.order,
      isDefault: s.isDefault,
      canDelete: s.canDelete,
      category: s.category,
    })),
    skipDuplicates: true,
  });

  await tx.ticketStatus.updateMany({
    where: { workspaceId, name: 'Removed' },
    data: { category: 'removed', canDelete: false },
  });

  // 7. Priorities
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

  // 8. Work types
  await tx.workType.createMany({
    data: DEFAULT_WORK_TYPES.map((w) => ({
      workspaceId,
      name: w.name,
      color: w.color,
      category: w.category,
    })),
    skipDuplicates: true,
  });

  return { roleIdsByName, ownerRoleId, defaultRoleId };
}

/**
 * Seeds the HubSpot Hub catalog (`DEFAULT_HUBS`) for a workspace under the
 * given plan-adding project type: each Hub, then a hub-scoped `Plan` row per
 * `HUB_TIERS` tier, then that hub's modules attached to every one of its
 * tiers — reusing the exact Plan -> Module -> seed-task pipeline the generic
 * Professional/Ultimate/Enterprise plans already go through.
 *
 * Idempotent (skips a Hub that already exists by name) so it's safe to call
 * both from fresh-workspace provisioning and the one-off backfill script for
 * workspaces created before Hubs existed.
 */
export async function provisionHubCatalog(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  projectTypeId: string,
) {
  await tx.hub.createMany({
    data: DEFAULT_HUBS.map((hub) => ({
      workspaceId,
      projectTypeId,
      name: hub.name,
    })),
    skipDuplicates: true,
  });

  const hubs = await tx.hub.findMany({
    where: { workspaceId, projectTypeId },
    select: { id: true, name: true },
  });
  const hubByName = new Map(hubs.map((h) => [h.name, h]));

  for (const hubDef of DEFAULT_HUBS) {
    const hub = hubByName.get(hubDef.name);
    if (!hub) continue;

    for (const tier of HUB_TIERS) {
      const existingPlan = await tx.plan.findFirst({
        where: { hubId: hub.id, name: tier },
        select: { id: true },
      });
      const plan =
        existingPlan ??
        (await tx.plan.create({
          data: {
            workspaceId,
            projectTypeId,
            hubId: hub.id,
            name: tier,
            isActive: true,
          },
        }));

      await tx.module.createMany({
        data: hubDef.modules.map((m) => ({
          workspaceId,
          planId: plan.id,
          key: m.key,
          name: m.name,
          defaultTaskLimit: m.defaultTaskLimit,
          isDefault: m.isDefault,
        })),
        skipDuplicates: true,
      });
    }
  }
}
