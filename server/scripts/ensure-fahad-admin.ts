import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EMAIL = 'fahad.mp@applus.com';
const PASSWORD = 'ApplusHub2026!';
const FULL_NAME = 'Fahad';

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: {
      fullName: FULL_NAME,
      role: 'Admin',
      passwordHash,
      identityProvider: 'local',
    },
    create: {
      email: EMAIL,
      fullName: FULL_NAME,
      role: 'Admin',
      passwordHash,
      identityProvider: 'local',
    },
    select: { id: true, email: true, role: true, fullName: true },
  });
  console.log('Admin ready:', user.email, user.role);
  console.log('Password:', PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
