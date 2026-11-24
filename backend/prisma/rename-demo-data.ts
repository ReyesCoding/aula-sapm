/**
 * One-off maintenance script: renombra los datos de ejemplo ya sembrados en
 * una base de datos existente para que luzcan más profesionales de cara a
 * un reclutador, SIN borrar nada (a diferencia de `seed.ts`, que limpia toda
 * la base antes de recrear). Seguro de correr una sola vez contra una base
 * que ya tenga datos reales de demo/testing que no quieres perder.
 *
 * Cambios:
 *  - Centro "Centro Legacy" (code: legacy) -> "Centro Horizonte" (code: horizonte)
 *  - Profesor demo "Profe. Javascript"      -> "Lic. Juan Pérez"
 *  - Estudiante demo "Pepito Estudiante"    -> "Pedro Jiménez"
 *  - Padre demo "Sr. Padre"                 -> "Roberto Jiménez"
 *
 * Uso: npx ts-node prisma/rename-demo-data.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const center = await prisma.educationalCenter.findFirst({
    where: { OR: [{ code: 'legacy' }, { name: 'Centro Legacy' }] },
  });
  if (center) {
    await prisma.educationalCenter.update({
      where: { id: center.id },
      data: { name: 'Centro Horizonte', code: 'horizonte' },
    });
    console.log(`🏫 Centro renombrado: "${center.name}" -> "Centro Horizonte" (code: horizonte)`);
  } else {
    console.log('🏫 Sin cambios: no se encontró un centro "Centro Legacy" / code "legacy".');
  }

  const renames: Array<{ email: string; newName: string }> = [
    { email: 'teacher@aula.com', newName: 'Lic. Juan Pérez' },
    { email: 'student@aula.com', newName: 'Pedro Jiménez' },
    { email: 'parent@aula.com', newName: 'Roberto Jiménez' },
  ];

  for (const { email, newName } of renames) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`👤 Sin cambios: no existe ningún usuario con email ${email}.`);
      continue;
    }
    if (user.name === newName) {
      console.log(`👤 Sin cambios: ${email} ya se llama "${newName}".`);
      continue;
    }
    await prisma.user.update({ where: { id: user.id }, data: { name: newName } });
    console.log(`👤 Renombrado: ${email} "${user.name}" -> "${newName}"`);
  }

  console.log('\n✅ Listo. Ningún otro dato (mensajes, tareas, calificaciones, foros, etc.) fue tocado.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
