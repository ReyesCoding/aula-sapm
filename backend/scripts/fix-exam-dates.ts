// Script de mantenimiento: si el dueDate de un examen seed ya pasó (demo
// usada en una entrevista en una fecha posterior al seed original), lo
// empuja 90 días hacia adelante para que "Tomar examen" siga siendo
// demostrable en vivo. Usa el Prisma Client / .env del propio proyecto —
// nunca imprime ni toca el connection string.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  const now = new Date();
  const exams = await prisma.exam.findMany({
    select: { id: true, title: true, dueDate: true },
  });

  let updated = 0;
  for (const exam of exams) {
    if (exam.dueDate < now) {
      const newDueDate = addDays(now, 90);
      await prisma.exam.update({
        where: { id: exam.id },
        data: { dueDate: newDueDate },
      });
      console.log(`Actualizado: "${exam.title}" -> nueva fecha limite ${newDueDate.toISOString()}`);
      updated++;
    } else {
      console.log(`Sin cambios (aun abierto): "${exam.title}" (${exam.dueDate.toISOString()})`);
    }
  }
  console.log(`\nListo. ${updated} examen(es) actualizado(s) de ${exams.length} total.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
