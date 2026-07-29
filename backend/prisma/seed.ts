


import '../src/load-env.js';
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { prisma } from '../src/db.js';
import { Role } from '../src/generated/prisma/enums.js';

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== Role.admin) {
      await prisma.user.update({ where: { email }, data: { role: Role.admin } });
      console.log(`Updated existing user ${email} to admin role.`);
    } else {
      console.log(`Admin user ${email} already exists, skipping.`);
    }
    return;
  }

  const userId = randomUUID();
  const hashed = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      id: userId,
      name: 'Admin',
      email,
      emailVerified: true,
      role: Role.admin,
      accounts: {
        create: {
          id: randomUUID(),
          accountId: userId,
          providerId: 'credential',
          password: hashed,
        },
      },
    },
  });

  console.log(`Created admin user ${user.email} (${user.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
