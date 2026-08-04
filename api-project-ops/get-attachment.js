const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const id = process.argv[2];

prisma.attachment
  .findUnique({ where: { id } })
  .then((row) => {
    console.log(JSON.stringify(row));
  })
  .finally(() => prisma.$disconnect());
