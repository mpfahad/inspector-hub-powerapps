import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { writeFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const rows = [
  { email: 'nisha.roy@applus.com', fullName: 'Nisha Roy' },
  { email: 'ezhil.amuthan@applus.com', fullName: 'Ezhil Amuthan' },
  { email: 'lester.pais@applus.com', fullName: 'Lester Pais' },
  { email: 'rosmi.john@applus.com', fullName: 'Rosmi John' },
  { email: 'steve.francis@applus.com', fullName: 'Steve Francis' },
];

function randomPassword() {
  return randomBytes(9).toString('base64url').slice(0, 12);
}

async function main() {
  const lift = await prisma.department.findFirst({ where: { code: 'LIFT' } });
  const rigs = await prisma.department.findFirst({ where: { code: 'RIGS' } });
  if (!lift || !rigs) throw new Error('LIFT/RIGS departments missing');

  const out: {
    email: string;
    fullName: string;
    role: string;
    departments: string;
    temporaryPassword: string;
    action: string;
  }[] = [];

  for (const r of rows) {
    const temporaryPassword = randomPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const existing = await prisma.user.findUnique({ where: { email: r.email } });

    let user;
    if (existing) {
      user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          fullName: r.fullName,
          role: existing.role === 'Admin' ? 'Admin' : 'Coordinator',
          passwordHash,
          identityProvider: 'local',
        },
      });
      await prisma.userDepartmentAccess.deleteMany({ where: { userId: user.id } });
    } else {
      user = await prisma.user.create({
        data: {
          email: r.email,
          fullName: r.fullName,
          role: 'Coordinator',
          passwordHash,
          identityProvider: 'local',
        },
      });
    }

    await prisma.userDepartmentAccess.createMany({
      data: [
        { userId: user.id, departmentId: lift.id },
        { userId: user.id, departmentId: rigs.id },
      ],
    });

    out.push({
      email: r.email,
      fullName: r.fullName,
      role: 'Coordinator',
      departments: 'Lifting, Rigs',
      temporaryPassword,
      action: existing ? 'updated' : 'created',
    });
  }

  const csv = [
    'email,fullName,role,departments,temporaryPassword,action',
    ...out.map(
      (r) =>
        `${r.email},${r.fullName},${r.role},"${r.departments}",${r.temporaryPassword},${r.action}`
    ),
  ].join('\n');

  const path = 'scripts/lifting-rigs-users-passwords.csv';
  writeFileSync(path, csv, 'utf8');
  console.log(JSON.stringify(out, null, 2));
  console.log(`Wrote ${path}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
