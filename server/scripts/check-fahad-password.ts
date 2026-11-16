import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const dbUrl = process.argv[2] ?? 'file:../uat-dev.db';
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

async function main() {
  const u = await prisma.user.findUnique({ where: { email: 'fahad.mp@applus.com' } });
  if (!u) {
    console.log('NO_USER fahad.mp@applus.com');
    return;
  }
  console.log({
    email: u.email,
    role: u.role,
    identityProvider: u.identityProvider,
    hasHash: Boolean(u.passwordHash),
  });
  for (const pw of ['ApplusHub2026!', 'password123']) {
    console.log(pw, u.passwordHash ? await bcrypt.compare(pw, u.passwordHash) : false);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
