import { PrismaClient, RoleName } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de base de datos...');

  // 1. Limpiar base de datos (Respetando integridad referencial)
  await prisma.assignment.deleteMany();
  await prisma.parentChild.deleteMany();
  await prisma.subject.deleteMany(); 
  await prisma.user.deleteMany();

  // 2. Crear Materias
  await prisma.subject.createMany({
    data: [
      { name: 'Matemáticas' },
      { name: 'Historia' },
      { name: 'Ciencias' },
      { name: 'Literatura' }
    ]
  });
  console.log('📚 Materias creadas.');

  // 3. Preparar credenciales
  const passwordHash = await bcrypt.hash('123456', 10);

  // 4. Crear Usuarios por Rol
  
  // Admin
  await prisma.user.create({
    data: { 
      name: 'Director Principal', 
      email: 'admin@aula.com', 
      password: passwordHash, 
      role: RoleName.ADMIN 
    },
  });

  // Teacher
  await prisma.user.create({
    data: { 
      name: 'Profe. Javascript', 
      email: 'teacher@aula.com', 
      password: passwordHash, 
      role: RoleName.TEACHER 
    },
  });

  // Student
  const student = await prisma.user.create({
    data: { 
      name: 'Pepito Estudiante', 
      email: 'student@aula.com', 
      password: passwordHash, 
      role: RoleName.STUDENT 
    },
  });

  // Parent (Vinculado al estudiante)
  await prisma.user.create({
    data: {
      name: 'Sr. Padre', 
      email: 'parent@aula.com', 
      password: passwordHash, 
      role: RoleName.PARENT,
      children: { 
        create: { childId: student.id } 
      }
    },
  });

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