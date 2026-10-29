/**
 * Backfill multi-centro (v2.0, PR1).
 * Ejecutar UNA VEZ, después de `npx prisma migrate dev`, contra la base de
 * datos real (no la de seed): crea "Centro Legacy" y asigna a él a todo
 * usuario (no ADMIN) y materia que hoy no tiene educationalCenterId.
 * Es idempotente: correrlo dos veces no duplica nada ni rompe datos.
 *
 * Uso:  npx ts-node prisma/backfill-legacy-center.ts
 */
import { PrismaClient, RoleName } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Backfill multi-centro: iniciando...');

  let center = await prisma.educationalCenter.findUnique({ where: { code: 'legacy' } });
  if (!center) {
    center = await prisma.educationalCenter.create({ data: { name: 'Centro Legacy', code: 'legacy' } });
    console.log('🏫 Centro Legacy creado.');
  } else {
    console.log('🏫 Centro Legacy ya existía, se reutiliza.');
  }

  const usersResult = await prisma.user.updateMany({
    where: { educationalCenterId: null, role: { not: RoleName.ADMIN } },
    data: { educationalCenterId: center.id },
  });
  console.log(`👤 ${usersResult.count} usuario(s) asignado(s) a Centro Legacy.`);

  const subjectsResult = await prisma.subject.updateMany({
    where: { educationalCenterId: null },
    data: { educationalCenterId: center.id },
  });
  console.log(`📚 ${subjectsResult.count} materia(s) asignada(s) a Centro Legacy.`);

  console.log('✅ Backfill completado. Cuando confirmes que todo quedó asignado, puedes volver');
  console.log('   Subject.educationalCenterId NOT NULL en schema.prisma y correr otra migración.');
}

main()
  .catch((e) => {
    console.error('❌ Error en el backfill:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
