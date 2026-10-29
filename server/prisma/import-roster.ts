/**
 * Upsert real Applus roster + Qatar clients into the live DB without a full wipe.
 * Prefer this over `db:seed` when you want to keep existing jobs/assignments.
 *
 * Usage: npx tsx prisma/import-roster.ts   (from server/)
 */
import { PrismaClient, UserRole, InspectorStatus, IdentityProvider, CertStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  FIELD_INSPECTOR_ROSTER,
  QATAR_CLIENTS,
  CERTIFICATION_CATALOG,
  PLACEHOLDER_CERT_ISSUED,
  PLACEHOLDER_CERT_EXPIRES,
  rosterMatchNames,
} from './inspectorRoster.js';

const prisma = new PrismaClient();

const DEMO_CLIENT_NAMES = [
  'Northshore Energy',
  'Helios Power',
  'Gulf Coast Refining',
  'Pacific Terminals',
];

/** Roster inspectors are Lifting — match existing row by code or name if present. */
async function ensureLiftingDept() {
  let lifting =
    (await prisma.department.findFirst({ where: { code: 'LIFT' } })) ??
    (await prisma.department.findFirst({
      where: { OR: [{ name: 'Lifting' }, { name: 'Lifting Inspection' }] },
    }));
  if (!lifting) {
    lifting = await prisma.department.create({
      data: {
        name: 'Lifting',
        code: 'LIFT',
        managerEmail: 'manager@irppms.local',
      },
    });
  }
  return lifting;
}

async function upsertCertCatalog() {
  const byCode = new Map<string, number>();
  for (const c of CERTIFICATION_CATALOG) {
    const row = await prisma.certification.upsert({
      where: { code: c.code },
      create: {
        code: c.code,
        name: c.name,
        issuer: c.issuer ?? null,
        validityMonths: c.validityMonths ?? null,
      },
      update: {
        name: c.name,
        issuer: c.issuer ?? null,
        validityMonths: c.validityMonths ?? null,
      },
    });
    byCode.set(c.code, row.id);
  }
  return byCode;
}

async function findInspector(row: (typeof FIELD_INSPECTOR_ROSTER)[number]) {
  const byEmp = await prisma.inspector.findUnique({ where: { employeeNo: row.employeeNo } });
  if (byEmp) return byEmp;
  const names = rosterMatchNames(row);
  return prisma.inspector.findFirst({ where: { name: { in: names } } });
}

async function upsertInspectorUsersAndCerts(
  liftingDeptId: number,
  certByCode: Map<string, number>,
  passwordHash: string
) {
  const keepEmployeeNos = new Set(FIELD_INSPECTOR_ROSTER.map((r) => r.employeeNo));
  const keepNames = new Set(FIELD_INSPECTOR_ROSTER.flatMap((r) => rosterMatchNames(r)));
  const issuedOn = new Date(PLACEHOLDER_CERT_ISSUED + 'T12:00:00');
  const expiresOn = new Date(PLACEHOLDER_CERT_EXPIRES + 'T12:00:00');

  let upserted = 0;
  for (const row of FIELD_INSPECTOR_ROSTER) {
    const email = row.email.trim().toLowerCase();
    const existing = await findInspector(row);

    const data = {
      name: row.name,
      employeeNo: row.employeeNo,
      email,
      departmentId: liftingDeptId,
      status: InspectorStatus.Active,
      dailyCostUsd: row.dailyCostUsd,
      dailyBillableUsd: row.dailyBillableUsd,
      qeApproved: row.qeApproved,
      highestQualification: row.highestQualification ?? null,
    };

    let inspectorId: number;
    if (existing) {
      // Free employeeNo collision if another row already has the new number
      if (existing.employeeNo !== row.employeeNo) {
        const clash = await prisma.inspector.findUnique({ where: { employeeNo: row.employeeNo } });
        if (clash && clash.id !== existing.id) {
          await prisma.inspector.update({
            where: { id: clash.id },
            data: { employeeNo: `OLD-${clash.id}-${clash.employeeNo}`.slice(0, 40) },
          });
        }
      }
      const updated = await prisma.inspector.update({ where: { id: existing.id }, data });
      inspectorId = updated.id;
    } else {
      const created = await prisma.inspector.create({ data });
      inspectorId = created.id;
      await prisma.inspectorCostHistory.create({
        data: {
          inspectorId,
          dailyCostUsd: row.dailyCostUsd,
          dailyBillableUsd: row.dailyBillableUsd,
          changedByEmail: 'system',
        },
      });
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          fullName: row.name,
          role: UserRole.Inspector,
          identityProvider: IdentityProvider.local,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          fullName: row.name,
          role: UserRole.Inspector,
          identityProvider: IdentityProvider.local,
        },
      });
    }
    await prisma.inspector.update({ where: { id: inspectorId }, data: { userId: user.id } });

    await prisma.inspectorCert.deleteMany({ where: { inspectorId } });
    for (const code of row.certCodes) {
      const certificationId = certByCode.get(code);
      if (!certificationId) continue;
      await prisma.inspectorCert.create({
        data: {
          inspectorId,
          certificationId,
          issuedOn,
          expiresOn,
          status: CertStatus.Valid,
        },
      });
    }
    upserted += 1;
  }

  // Remove roster names no longer in the matrix (e.g. Ezhil, Abbe) when they have no open work
  const stale = await prisma.inspector.findMany({
    where: {
      AND: [
        { employeeNo: { notIn: [...keepEmployeeNos] } },
        { name: { notIn: [...keepNames] } },
      ],
    },
    include: {
      assignments: { where: { status: { in: ['Proposed', 'PendingAcceptance', 'Accepted', 'Active'] } } },
    },
  });
  let removed = 0;
  for (const ins of stale) {
    if (ins.assignments.length > 0) {
      console.warn(`Keeping stale inspector ${ins.name} (${ins.employeeNo}) — has open assignments`);
      continue;
    }
    await prisma.timesheetLine.deleteMany({ where: { timesheet: { inspectorId: ins.id } } });
    await prisma.timesheet.deleteMany({ where: { inspectorId: ins.id } });
    await prisma.leaveRequest.deleteMany({ where: { inspectorId: ins.id } });
    await prisma.activityLog.deleteMany({ where: { inspectorId: ins.id } });
    await prisma.assignmentResponse.deleteMany({ where: { assignment: { inspectorId: ins.id } } });
    await prisma.assignment.deleteMany({ where: { inspectorId: ins.id } });
    await prisma.assignmentProposal.deleteMany({ where: { inspectorId: ins.id } });
    await prisma.inspectorCert.deleteMany({ where: { inspectorId: ins.id } });
    await prisma.inspectorCostHistory.deleteMany({ where: { inspectorId: ins.id } });
    const userId = ins.userId;
    await prisma.inspector.delete({ where: { id: ins.id } });
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId, role: UserRole.Inspector } });
    }
    removed += 1;
    console.log(`Removed stale inspector: ${ins.name}`);
  }

  return { upserted, removed };
}

async function upsertClients() {
  // Drop legacy demo clients with no jobs
  for (const name of DEMO_CLIENT_NAMES) {
    const c = await prisma.client.findFirst({ where: { name } });
    if (!c) continue;
    const jobs = await prisma.job.count({ where: { clientId: c.id } });
    if (jobs > 0) {
      console.warn(`Keeping demo client ${name} — has ${jobs} job(s)`);
      continue;
    }
    await prisma.client.delete({ where: { id: c.id } });
  }

  let upserted = 0;
  for (const c of QATAR_CLIENTS) {
    const existing = await prisma.client.findFirst({ where: { name: c.name } });
    if (existing) {
      await prisma.client.update({
        where: { id: existing.id },
        data: {
          location: c.location,
          latitude: c.latitude,
          longitude: c.longitude,
          industry: c.industry ?? null,
        },
      });
    } else {
      await prisma.client.create({
        data: {
          name: c.name,
          location: c.location,
          latitude: c.latitude,
          longitude: c.longitude,
          industry: c.industry ?? null,
        },
      });
    }
    upserted += 1;
  }
  return upserted;
}

/** Ensure staff UAT accounts exist (especially Admin) after roster-only imports. */
async function ensureStaffUsers(passwordHash: string) {
  const staff = [
    { email: 'coordinator@irppms.local', fullName: 'Alex Coordinator', role: UserRole.Coordinator },
    { email: 'manager@irppms.local', fullName: 'Sarah Hollis', role: UserRole.Manager },
    { email: 'admin@irppms.local', fullName: 'System Admin', role: UserRole.Admin },
  ] as const;

  for (const u of staff) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (!existing) {
      await prisma.user.create({
        data: {
          email: u.email,
          passwordHash,
          fullName: u.fullName,
          role: u.role,
          identityProvider: IdentityProvider.local,
        },
      });
      continue;
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: u.role,
        fullName: u.fullName,
        identityProvider: IdentityProvider.local,
        ...(existing.passwordHash ? {} : { passwordHash }),
      },
    });
  }
}

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);
  await ensureStaffUsers(passwordHash);
  const lifting = await ensureLiftingDept();
  const certByCode = await upsertCertCatalog();
  const { upserted, removed } = await upsertInspectorUsersAndCerts(lifting.id, certByCode, passwordHash);
  const clients = await upsertClients();

  console.log('');
  console.log(`Department: ${lifting.name} (${lifting.code})`);
  console.log(`Inspectors upserted: ${upserted} (removed stale: ${removed})`);
  console.log(`Clients upserted: ${clients}`);
  console.log(`Cert catalog: ${CERTIFICATION_CATALOG.length} codes`);
  console.log('QP Approved Inspector → Inspector.qeApproved (Sooraj is trainer-only, qeApproved=false)');
  console.log('Staff logins: admin@ / coordinator@ / manager@ irppms.local + password123');
  console.log('Inspector logins: work email + password123');
  console.log('Cert dates: placeholder 2024-01-01 → 2029-01-01 (Valid)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
