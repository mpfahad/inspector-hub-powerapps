/**
 * Upsert RIG Inspection HR roster into department Rigs (code RIGS).
 * Does not wipe other departments. Prefer over full seed when adding this list.
 *
 * Usage: npx tsx prisma/import-rigs-roster.ts
 */
import { PrismaClient, InspectorStatus } from '@prisma/client';
import { RIGS_EMPLOYEES } from './rigsRoster.js';

const prisma = new PrismaClient();

async function ensureRigsDept() {
  let dept =
    (await prisma.department.findFirst({ where: { code: 'RIGS' } })) ??
    (await prisma.department.findFirst({ where: { name: 'Rigs' } }));
  if (!dept) {
    dept = await prisma.department.create({
      data: {
        name: 'Rigs',
        code: 'RIGS',
        managerEmail: 'manager@irppms.local',
      },
    });
  }
  return dept;
}

async function findExisting(employeeNo: string, name: string) {
  const byEmp = await prisma.inspector.findUnique({ where: { employeeNo } });
  if (byEmp) return byEmp;
  // Match lifting-roster Aju Joseph etc. by exact name when emp no differs historically
  return prisma.inspector.findFirst({ where: { name } });
}

async function main() {
  const rigs = await ensureRigsDept();
  let created = 0;
  let updated = 0;

  for (const row of RIGS_EMPLOYEES) {
    const hireDate = new Date(row.engagementDate + 'T12:00:00');
    const existing = await findExisting(row.employeeNo, row.name);

    if (!existing) {
      await prisma.inspector.create({
        data: {
          employeeNo: row.employeeNo,
          name: row.name,
          departmentId: rigs.id,
          jobTitle: row.jobTitle,
          hireDate,
          status: InspectorStatus.Active,
          dailyCostUsd: row.dailyCostUsd,
          dailyBillableUsd: row.dailyBillableUsd,
          qeApproved: false,
          baseLocation: 'Qatar — RIG Inspection Onshore',
        },
      });
      created += 1;
      continue;
    }

    await prisma.inspector.update({
      where: { id: existing.id },
      data: {
        employeeNo: row.employeeNo,
        name: row.name,
        departmentId: rigs.id,
        jobTitle: row.jobTitle,
        hireDate,
        status: InspectorStatus.Active,
        // Keep existing rates if already set; otherwise apply provisional
        dailyCostUsd: existing.dailyCostUsd ?? row.dailyCostUsd,
        dailyBillableUsd: existing.dailyBillableUsd ?? row.dailyBillableUsd,
        baseLocation: existing.baseLocation ?? 'Qatar — RIG Inspection Onshore',
      },
    });
    updated += 1;
  }

  console.log(`Department: ${rigs.name} (${rigs.code})`);
  console.log(`Rigs roster: created ${created}, updated ${updated}, total ${RIGS_EMPLOYEES.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
