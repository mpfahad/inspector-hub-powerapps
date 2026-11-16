import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const jobCols = (await prisma.$queryRawUnsafe<
    { name: string }[]
  >(`PRAGMA table_info(Job)`)).map((c) => c.name);

  const tables = (
    await prisma.$queryRawUnsafe<{ name: string }[]>(
      `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
    )
  ).map((t) => t.name);

  const accessCols = tables.includes('UserDepartmentAccess')
    ? (
        await prisma.$queryRawUnsafe<{ name: string }[]>(
          `PRAGMA table_info(UserDepartmentAccess)`
        )
      ).map((c) => c.name)
    : [];

  const admin = await prisma.user.findUnique({
    where: { email: 'fahad.mp@applus.com' },
    select: { id: true, email: true, role: true },
  });

  const userCount = await prisma.user.count();
  const accessCount = tables.includes('UserDepartmentAccess')
    ? await prisma.userDepartmentAccess.count()
    : 0;

  const sampleJob = await prisma.job.findFirst({
    select: { id: true, autoCompleteOnEndDate: true, rateBasis: true },
  });

  const report = {
    ok:
      jobCols.includes('autoCompleteOnEndDate') &&
      jobCols.includes('rateBasis') &&
      tables.includes('UserDepartmentAccess') &&
      Boolean(admin) &&
      admin?.role === 'Admin',
    checks: {
      Job_autoCompleteOnEndDate: jobCols.includes('autoCompleteOnEndDate'),
      Job_rateBasis: jobCols.includes('rateBasis'),
      UserDepartmentAccess_table: tables.includes('UserDepartmentAccess'),
      UserDepartmentAccess_cols: accessCols,
      primaryAdmin: admin,
      userCount,
      userDepartmentAccessRows: accessCount,
      sampleJobFields: sampleJob,
    },
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
