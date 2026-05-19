import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@talklight.com';
  const username = 'admin';
  const password = 'Admin123!';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('⚠️  Admin user already exists');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.create({
    data: {
      email,
      username,
      passwordHash,
      role: 'ADMIN',
    },
  });

  console.log('✅ Admin user created!');
  console.log('');
  console.log('📧 Email:    admin@talklight.com');
  console.log('🔑 Password: Admin123!');
  console.log('');
  console.log('Go to http://localhost:5173/login to connect');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
