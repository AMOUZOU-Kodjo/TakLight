import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst();
  
  if (!user) {
    console.log('❌ Aucun utilisateur trouvé');
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: 'ADMIN' },
  });

  console.log(`✅ Utilisateur ${user.email} est maintenant ADMIN !`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
