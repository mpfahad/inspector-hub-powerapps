/**
 * One-shot: remove Inspector User logins (Manager/Coordinator/Admin kept).
 * Also runs automatically on API startup via applyProductDefaults.
 *
 *   npm run db:purge-inspector-logins --prefix server
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const inspectors = await prisma.user.findMany({
    where: { role: 'Inspector' },
    select: { id: true, email: true },
  });
  if (inspectors.length === 0) {
    console.log('No Inspector logins to purge.');
    return;
  }
  const ids = inspectors.map((u) => u.id);
  await prisma.$transaction([
    prisma.inspector.updateMany({ where: { userId: { in: ids } }, data: { userId: null } }),
    prisma.auditEvent.updateMany({ where: { userId: { in: ids } }, data: { userId: null } }),
    prisma.user.deleteMany({ where: { id: { in: ids } } }),
  ]);
  console.log(`Purged ${inspectors.length} Inspector login(s):`);
  for (const u of inspectors) console.log(`  - ${u.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
