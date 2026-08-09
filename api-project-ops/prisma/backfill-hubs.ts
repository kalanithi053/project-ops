/**
 * One-off backfill: seeds the HubSpot Hub catalog (`DEFAULT_HUBS`) for every
 * workspace that existed before Hubs were introduced. `seed.ts` only
 * provisions defaults for a brand-new workspace, so workspaces created
 * earlier never got Hubs/hub-scoped Plans.
 *
 * Idempotent — safe to re-run (`provisionHubCatalog` skips a Hub that already
 * exists by name, and reuses an existing hub-scoped Plan by name instead of
 * duplicating it).
 *
 * Run with: npx ts-node prisma/backfill-hubs.ts
 */
import { PrismaClient } from '@prisma/client';
import { provisionHubCatalog } from '../src/workspaces/workspace-provisioning';

const prisma = new PrismaClient();

async function main() {
  const workspaces = await prisma.workspace.findMany({
    select: { id: true, name: true },
  });

  for (const workspace of workspaces) {
    const projectTypes = await prisma.projectType.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, isPlanAdd: true },
    });
    const planProjectTypeId =
      projectTypes.find((t) => t.isPlanAdd)?.id ?? projectTypes[0]?.id;

    if (!planProjectTypeId) {
      console.log(
        `Skipping "${workspace.name}" (${workspace.id}) — no project type to attach Hubs to.`,
      );
      continue;
    }

    await prisma.$transaction((tx) =>
      provisionHubCatalog(tx, workspace.id, planProjectTypeId),
    );
    console.log(`Backfilled Hub catalog for "${workspace.name}" (${workspace.id}).`);
  }

  console.log('Hub backfill complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
