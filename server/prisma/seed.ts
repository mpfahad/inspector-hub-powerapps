import { PrismaClient, UserRole, InspectorStatus, IdentityProvider, CertStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  FIELD_INSPECTOR_ROSTER,
  QATAR_CLIENTS,
  CERTIFICATION_CATALOG,
  PLACEHOLDER_CERT_ISSUED,
  PLACEHOLDER_CERT_EXPIRES,
} from './inspectorRoster.js';

const prisma = new PrismaClient();

async function main() {
  await prisma.notification.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.timesheetLine.deleteMany();
  await prisma.timesheet.deleteMany();
  await prisma.assignmentResponse.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.assignmentProposal.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.jobStatusHistory.deleteMany();
  await prisma.jobCertRequirement.deleteMany();
  await prisma.jobTypeCertRequirement.deleteMany();
  await prisma.job.deleteMany();
  await prisma.priceChart.deleteMany();
  await prisma.jobType.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.inspectorCostHistory.deleteMany();
  await prisma.inspectorCert.deleteMany();
  await prisma.inspector.deleteMany();
  await prisma.certification.deleteMany();
  await prisma.qualification.deleteMany();
  await prisma.client.deleteMany();
  await prisma.department.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  await prisma.user.createMany({
    data: [
      { email: 'coordinator@irppms.local', passwordHash, fullName: 'Alex Coordinator', role: UserRole.Coordinator, identityProvider: IdentityProvider.local },
      { email: 'jordan.coord@irppms.local', passwordHash, fullName: 'Jordan Patel', role: UserRole.Coordinator, identityProvider: IdentityProvider.local },
      { email: 'manager@irppms.local', passwordHash, fullName: 'Sarah Hollis', role: UserRole.Manager, identityProvider: IdentityProvider.local },
      { email: 'marcus.mgr@irppms.local', passwordHash, fullName: 'Marcus Chen', role: UserRole.Manager, identityProvider: IdentityProvider.local },
      { email: 'admin@irppms.local', passwordHash, fullName: 'System Admin', role: UserRole.Admin, identityProvider: IdentityProvider.local },
    ],
  });

  const depts = await Promise.all([
    prisma.department.create({ data: { name: 'Mechanical Inspection', code: 'MECH', managerEmail: 'manager@irppms.local' } }),
    prisma.department.create({ data: { name: 'NDT Inspection', code: 'NDT', managerEmail: 'marcus.mgr@irppms.local' } }),
    prisma.department.create({ data: { name: 'Electrical Inspection', code: 'ELEC', managerEmail: 'manager@irppms.local' } }),
    prisma.department.create({ data: { name: 'Lifting', code: 'LIFT', managerEmail: 'manager@irppms.local' } }),
    prisma.department.create({ data: { name: 'Unassigned', code: 'HOLD', managerEmail: 'coordinator@irppms.local' } }),
  ]);
  const liftingDept = depts[3];

  for (const c of QATAR_CLIENTS) {
    await prisma.client.create({
      data: {
        name: c.name,
        industry: c.industry ?? null,
        location: c.location,
        latitude: c.latitude,
        longitude: c.longitude,
      },
    });
  }

  const certByCode = new Map<string, number>();
  for (const c of CERTIFICATION_CATALOG) {
    const row = await prisma.certification.create({
      data: {
        code: c.code,
        name: c.name,
        issuer: c.issuer ?? null,
        validityMonths: c.validityMonths ?? null,
      },
    });
    certByCode.set(c.code, row.id);
  }

  // Keep a few legacy job-type certs for demo job types (also in catalog above if overlapping)
  const api510 = await prisma.certification.upsert({
    where: { code: 'API 510' },
    create: { code: 'API 510', name: 'Pressure Vessel Inspector', issuer: 'API', validityMonths: 36 },
    update: {},
  });
  const paut = await prisma.certification.upsert({
    where: { code: 'NDT L-II PAUT' },
    create: { code: 'NDT L-II PAUT', name: 'PAUT Level II', issuer: 'PCN', validityMonths: 60 },
    update: {},
  });
  const ut = await prisma.certification.upsert({
    where: { code: 'NDT L-II UT' },
    create: { code: 'NDT L-II UT', name: 'UT Level II', issuer: 'ASNT', validityMonths: 36 },
    update: {},
  });
  const cswip = await prisma.certification.upsert({
    where: { code: 'CSWIP 3.1' },
    create: { code: 'CSWIP 3.1', name: 'Welding Inspector', issuer: 'TWI', validityMonths: 60 },
    update: {},
  });

  const jobTypes = await Promise.all([
    prisma.jobType.create({
      data: {
        code: 'PVI',
        name: 'Pressure Vessel Inspection',
        description: 'API 510 pressure vessel and tank inspections',
        defaultPriceUsd: 4500,
        certRequirements: { create: [{ certificationId: api510.id, mandatory: true }] },
      },
    }),
    prisma.jobType.create({
      data: {
        code: 'NDT-UT',
        name: 'NDT Ultrasonic Survey',
        description: 'Ultrasonic and phased-array NDT surveys',
        defaultPriceUsd: 5200,
        certRequirements: {
          create: [
            { certificationId: paut.id, mandatory: true },
            { certificationId: ut.id, mandatory: true },
          ],
        },
      },
    }),
    prisma.jobType.create({
      data: {
        code: 'WELD',
        name: 'Welding Inspection',
        description: 'Welding and fabrication quality inspections',
        defaultPriceUsd: 3800,
        certRequirements: { create: [{ certificationId: cswip.id, mandatory: true }] },
      },
    }),
    prisma.jobType.create({
      data: {
        code: 'MECH',
        name: 'General Mechanical Inspection',
        description: 'Routine mechanical integrity inspections',
        defaultPriceUsd: 2800,
      },
    }),
  ]);

  await prisma.priceChart.create({ data: { jobTypeId: null, priceUsd: 3000 } });
  for (const type of jobTypes) {
    if (type.defaultPriceUsd != null) {
      await prisma.priceChart.create({ data: { jobTypeId: type.id, priceUsd: type.defaultPriceUsd } });
    }
  }

  const issuedOn = new Date(PLACEHOLDER_CERT_ISSUED + 'T12:00:00');
  const expiresOn = new Date(PLACEHOLDER_CERT_EXPIRES + 'T12:00:00');

  for (const row of FIELD_INSPECTOR_ROSTER) {
    const email = row.email.trim().toLowerCase();
    const inspector = await prisma.inspector.create({
      data: {
        employeeNo: row.employeeNo,
        name: row.name,
        email,
        departmentId: liftingDept.id,
        status: InspectorStatus.Active,
        dailyCostUsd: row.dailyCostUsd,
        dailyBillableUsd: row.dailyBillableUsd,
        qeApproved: row.qeApproved,
        highestQualification: row.highestQualification ?? null,
      },
    });

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: row.name,
        role: UserRole.Inspector,
        identityProvider: IdentityProvider.local,
      },
    });
    await prisma.inspector.update({ where: { id: inspector.id }, data: { userId: user.id } });

    await prisma.inspectorCostHistory.create({
      data: {
        inspectorId: inspector.id,
        dailyCostUsd: row.dailyCostUsd,
        dailyBillableUsd: row.dailyBillableUsd,
        changedByEmail: 'system',
      },
    });

    for (const code of row.certCodes) {
      const certificationId = certByCode.get(code);
      if (!certificationId) continue;
      await prisma.inspectorCert.create({
        data: {
          inspectorId: inspector.id,
          certificationId,
          issuedOn,
          expiresOn,
          status: CertStatus.Valid,
        },
      });
    }
  }

  const qeCount = FIELD_INSPECTOR_ROSTER.filter((r) => r.qeApproved).length;
  console.log('Seed complete (full wipe).');
  console.log(`Inspectors: ${FIELD_INSPECTOR_ROSTER.length} | Clients: ${QATAR_CLIENTS.length} | Cert catalog: ${CERTIFICATION_CATALOG.length}`);
  console.log(`QE-approved (QP Approved Inspector): ${qeCount}`);
  console.log('All passwords: password123');
  console.log('');
  console.log('Prefer live upsert without wipe: npx tsx prisma/import-roster.ts');
  console.log('Sample jobs for reports: npm run db:seed-sample-jobs');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
