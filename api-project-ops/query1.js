const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const workspaces = await prisma.workspace.findMany({ take: 5 });
  console.log('WORKSPACES', JSON.stringify(workspaces, null, 2));
  const projects = await prisma.project.findMany({ take: 5 });
  console.log('PROJECTS', JSON.stringify(projects, null, 2));
  const workItems = await prisma.workItem.findMany({ take: 5 });
  console.log('WORKITEMS', JSON.stringify(workItems, null, 2));
})().finally(() => prisma.$disconnect());
