/**
 * Seed script — creates a demo workspace fully provisioned with default roles
 * (Owner/Admin/Member/Viewer), the permission catalog, default modules
 * (Pipeline: 10, Custom Properties: 20), the ticket status pipeline
 * (Backlog/In Progress/Done) and a Free plan, owned by a demo user.
 *
 * Idempotent: re-running detects the existing demo workspace and skips.
 *
 * Run with: npm run db:seed
 */
import { PrismaClient } from '@prisma/client';
import { provisionWorkspaceDefaults } from '../src/workspaces/workspace-provisioning';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo.workspace@projectops.com';
const DEMO_WORKSPACE_SLUG = 'demo.workspace';

async function main() {
  const owner = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      firstName: 'Demo',
      lastName: 'Owner',
      isVerified: true,
    },
  });

  const existing = await prisma.workspace.findUnique({
    where: { slug: DEMO_WORKSPACE_SLUG },
  });
  if (existing) {
    console.log(
      `Amwhiz workspace "${DEMO_WORKSPACE_SLUG}" already exists (${existing.id}); skipping.`,
    );
    return;
  }

  const workspace = await prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.create({
      data: {
        name: 'Demo Workspace',
        slug: DEMO_WORKSPACE_SLUG,
        ownerId: owner.id,
      },
    });

    const { ownerRoleId } = await provisionWorkspaceDefaults(tx, ws.id);

    await tx.workspaceMember.create({
      data: {
        workspaceId: ws.id,
        userId: owner.id,
        roleId: ownerRoleId,
        status: 'active',
      },
    });

    return ws;
  });

  console.log('Seed complete:');
  console.log(`  Demo user      : ${owner.email} (${owner.id})`);
  console.log(`  Demo workspace : ${workspace.name} (${workspace.id})`);
  console.log(
    `  Login flow     : POST /api/v1/auth/otp/request { "email": "${DEMO_EMAIL}" }`,
  );
  console.log(
    '  Watch the server console for the OTP code, then verify + select the workspace.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
