/**
 * One-off backfill: seeds the `hub.manage` UserPermission row for every
 * workspace that existed before it was added to PERMISSION_CATALOG, and
 * grants it to that workspace's Owner role — mirroring `plan.manage`'s
 * existing owner-only restriction (see DEFAULT_ROLES in
 * common/constants/permissions.ts).
 *
 * `provisionWorkspaceDefaults` only seeds the permission catalog for a
 * brand-new workspace, so workspaces created earlier never got this row.
 *
 * Idempotent — `skipDuplicates` on both createMany calls.
 *
 * Run with: npx ts-node prisma/backfill-hub-permission.ts
 */
import { PrismaClient } from '@prisma/client';
import { PERMISSIONS } from '../src/common/constants/permissions';

const prisma = new PrismaClient();

async function main() {
  const workspaces = await prisma.workspace.findMany({
    select: { id: true, name: true },
  });

  for (const workspace of workspaces) {
    await prisma.userPermission.createMany({
      data: [
        {
          workspaceId: workspace.id,
          code: PERMISSIONS.HUB_MANAGE,
          description: 'Manage HubSpot hubs',
        },
      ],
      skipDuplicates: true,
    });

    const permission = await prisma.userPermission.findFirst({
      where: { workspaceId: workspace.id, code: PERMISSIONS.HUB_MANAGE },
    });
    const ownerRole = await prisma.userRole.findFirst({
      where: { workspaceId: workspace.id, name: 'Owner' },
    });

    if (!permission || !ownerRole) {
      console.log(
        `Skipping "${workspace.name}" (${workspace.id}) — missing permission or Owner role.`,
      );
      continue;
    }

    await prisma.rolePermission.createMany({
      data: [{ roleId: ownerRole.id, permissionId: permission.id }],
      skipDuplicates: true,
    });
    console.log(`Backfilled hub.manage for "${workspace.name}" (${workspace.id}).`);
  }

  console.log('hub.manage backfill complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
