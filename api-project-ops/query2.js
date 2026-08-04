const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const p = await prisma.project.findUnique({ where: { id: '59dfae6c-2536-430a-9059-8a25fc8d80c1' } });
  console.log('PROJECT', JSON.stringify(p, null, 2));
  const wis = await prisma.workItem.findMany({ where: { projectId: '59dfae6c-2536-430a-9059-8a25fc8d80c1' } });
  console.log('WORKITEMS', JSON.stringify(wis, null, 2));
  const members = await prisma.workspaceMember.findMany({ where: { workspaceId: 'e2869ca1-b0ba-4def-8968-07b5ac4ddf17' } });
  console.log('MEMBERS', JSON.stringify(members, null, 2));
})().catch(e=>console.error(e)).finally(() => prisma.$disconnect());
