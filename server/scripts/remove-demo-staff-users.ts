import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Generic UAT staff accounts — removed in favor of fahad.mp@applus.com Admin + Settings-created users. */
const DEMO_EMAILS = [
  'coordinator@irppms.local',
  'jordan.coord@irppms.local',
  'manager@irppms.local',
  'marcus.mgr@irppms.local',
  'admin@irppms.local',
];

async function main() {
  const result = await prisma.user.deleteMany({
    where: { email: { in: DEMO_EMAILS } },
  });
  console.log(`Removed ${result.count} demo staff user(s):`, DEMO_EMAILS.join(', '));
  await prisma.department.updateMany({
    where: { managerEmail: { in: DEMO_EMAILS } },
    data: { managerEmail: 'fahad.mp@applus.com' },
  });
  console.log('Department managerEmail pointers updated to fahad.mp@applus.com where needed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
