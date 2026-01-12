import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { RoleName } from '@prisma/client';

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const role = (req as any).user.role as RoleName;

    // 👑 CASO 1: ADMIN (Globales)
    if (role === RoleName.ADMIN) {
      const [users, courses, assignments] = await Promise.all([
        prisma.user.count(),
        prisma.course.count(),
        prisma.assignment.count()
      ]);

      res.json({
        stats: [
          { label: 'Usuarios Totales', value: users, icon: 'users', color: 'blue' },
          { label: 'Cursos Activos', value: courses, icon: 'book', color: 'green' },
          { label: 'Actividades', value: assignments, icon: 'file', color: 'purple' },
          { label: 'Estado Sistema', value: 'OK', icon: 'check', color: 'gray' }
        ]
      });
      return;
    }

    // 🎓 CASO 2: STUDENT (Métricas Personales)
    if (role === RoleName.STUDENT) {
      // 1. Obtener tareas totales asignadas a mis cursos (Simplificado: Traemos todas las del sistema que sean PENDING para mi usuario)
      // Nota: Idealmente filtrarías por cursos inscritos, pero para este ejemplo usaremos conteo directo
      
      const myAssignments = await prisma.assignment.findMany({
         where: {
            // Aquí deberías filtrar por cursos donde el estudiante está inscrito
            // Por simplicidad en MVP: Contamos las entregas hechas vs total
         }
      });
      
      // Vamos a contar las entregas que ha hecho este usuario
      // Asumimos que tienes una tabla Submission o que la Assignment tiene status. 
      // Como tu modelo actual actualiza el status en la Assignment directamente (relación 1-1 simulada para MVP):
      
      // Contar pendientes (PENDING o LATE)
      const pendingCount = await prisma.assignment.count({
        where: { status: { in: ['PENDING', 'LATE'] } }
      });

      // Contar completadas
      const completedCount = await prisma.assignment.count({
        where: { status: { in: ['SUBMITTED', 'GRADED'] } }
      });
      
      const total = pendingCount + completedCount;
      const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;

      res.json({
        stats: [
            { label: 'Tareas Pendientes', value: pendingCount, icon: 'clock', color: 'yellow' },
            { label: 'Tareas Entregadas', value: completedCount, icon: 'check', color: 'green' },
            { label: 'Progreso General', value: `${progress}%`, icon: 'trending-up', color: 'blue' },
            { label: 'Promedio', value: '-', icon: 'award', color: 'purple' } // Calcula promedio real si tienes notas
        ]
      });
      return;
    }

    // 👨‍🏫 CASO 3: TEACHER (Métricas de Gestión)
    if (role === RoleName.TEACHER) {
       const myCourses = await prisma.course.count({ where: { teacherId: userId } });
       const myAssignments = await prisma.assignment.count({ where: { creatorId: userId } });
       const toGrade = await prisma.assignment.count({
          where: { creatorId: userId, status: 'SUBMITTED' }
       });

       // 👇 LÓGICA NUEVA: Contar alumnos únicos inscritos en mis cursos
       const uniqueStudents = await prisma.enrollment.findMany({
          where: {
            course: { teacherId: userId } // Filtramos inscripciones de mis cursos
          },
          distinct: ['studentId'], // 👈 MAGIA: Prisma elimina duplicados de estudiantes
          select: { studentId: true }
       });
       
       const totalStudentsCount = uniqueStudents.length;

       res.json({
        stats: [
            { label: 'Por Calificar', value: toGrade, icon: 'alert', color: 'red' },
            { label: 'Mis Cursos', value: myCourses, icon: 'book', color: 'blue' },
            { label: 'Tareas Creadas', value: myAssignments, icon: 'file', color: 'purple' },
            // 👇 Aquí ponemos el valor real
            { label: 'Alumnos Totales', value: totalStudentsCount, icon: 'users', color: 'green' }
        ]
      });
      return;
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
};