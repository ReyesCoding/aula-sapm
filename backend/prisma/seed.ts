import { PrismaClient, RoleName } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de base de datos...');

  // 1. Limpiar base de datos (respetando integridad referencial: hijos antes que padres)
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.parentChild.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.user.deleteMany();
  await prisma.educationalCenter.deleteMany();

  // 2. Centro educativo por defecto (v2.0 multi-centro)
  const center = await prisma.educationalCenter.create({
    data: { name: 'Centro Legacy', code: 'legacy' },
  });
  console.log('🏫 Centro educativo creado.');

  // 3. Preparar credenciales
  const passwordHash = await bcrypt.hash('123456', 10);

  // 4. Crear usuarios por rol
  // Admin: rol de plataforma, NO pertenece a un centro (educationalCenterId null)
  await prisma.user.create({
    data: {
      name: 'Director Principal',
      email: 'admin@aula.com',
      password: passwordHash,
      role: RoleName.ADMIN,
    },
  });

  // Centro: administrador del centro educativo
  await prisma.user.create({
    data: {
      name: 'Administración Centro Legacy',
      email: 'centro@aula.com',
      password: passwordHash,
      role: RoleName.CENTRO,
      educationalCenterId: center.id,
    },
  });

  const teacher = await prisma.user.create({
    data: {
      name: 'Profe. Javascript',
      email: 'teacher@aula.com',
      password: passwordHash,
      role: RoleName.TEACHER,
      educationalCenterId: center.id,
    },
  });

  const student = await prisma.user.create({
    data: {
      name: 'Pepito Estudiante',
      email: 'student@aula.com',
      password: passwordHash,
      role: RoleName.STUDENT,
      educationalCenterId: center.id,
    },
  });

  await prisma.user.create({
    data: {
      name: 'Sr. Padre',
      email: 'parent@aula.com',
      password: passwordHash,
      role: RoleName.PARENT,
      educationalCenterId: center.id,
      children: { create: { childId: student.id } },
    },
  });

  console.log('👤 Usuarios creados (Admin, Centro, Teacher, Student, Parent).');

  // 5. Materias (requieren teacherId + code + educationalCenterId en el schema actual)
  await prisma.subject.createMany({
    data: [
      { name: 'Matemáticas', code: 'MAT-101', teacherId: teacher.id, educationalCenterId: center.id },
      { name: 'Historia', code: 'HIS-101', teacherId: teacher.id, educationalCenterId: center.id },
      { name: 'Ciencias', code: 'CIE-101', teacherId: teacher.id, educationalCenterId: center.id },
      { name: 'Literatura', code: 'LIT-101', teacherId: teacher.id, educationalCenterId: center.id },
    ],
  });
  console.log('📚 Materias creadas.');

  console.log('✅ Seed completado con éxito.');
}

main()
  .catch((e) => {
    console.error('❌ Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
