import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { RoleName } from '@prisma/client';

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    // @ts-ignore
    const userId = req.user.userId;
    // @ts-ignore
    const role = req.user.role as RoleName;

    // 👑 CASO 1: ADMIN
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

    // 🎓 CASO 2: STUDENT
    if (role === RoleName.STUDENT) {
      
      // 1. TAREAS: Contar pendientes y completadas
      const pendingCount = await prisma.assignment.count({
        where: { 
            studentId: userId,
            status: { in: ['PENDING', 'LATE'] } 
        }
      });

      const completedCount = await prisma.assignment.count({
        where: { 
            studentId: userId,
            status: { in: ['SUBMITTED', 'GRADED'] } 
        }
      });

      // 2. CALCULAR PROMEDIO
      
      // A) Traer notas de Tareas Calificadas
      const gradedAssignments = await prisma.assignment.findMany({
        where: { 
            studentId: userId,
            status: 'GRADED',
            grade: { not: null } 
        },
        select: { grade: true }
      });

      // B) Traer notas de Exámenes (Usamos la tabla ExamSubmission)
      const gradedExams = await prisma.examSubmission.findMany({
        where: { studentId: userId },
        select: { score: true }
      });

      // C) Unificar y Calcular (Solución del error TypeScript)
      // Creamos un array estrictamente de números. Si viene null, usamos 0.
      const allGrades: number[] = [
        ...gradedAssignments.map(a => a.grade ?? 0), 
        ...gradedExams.map(e => e.score ?? 0)       
      ];

      let averageDisplay = "-";
      
      if (allGrades.length > 0) {
        // Ahora TypeScript sabe que 'a' y 'b' siempre son números
        const sum = allGrades.reduce((a, b) => a + b, 0);
        const avg = sum / allGrades.length;
        averageDisplay = avg.toFixed(1); 
      }

      // Cálculo de progreso visual
      const totalActivities = pendingCount + completedCount;
      const progress = totalActivities > 0 ? Math.round((completedCount / totalActivities) * 100) : 0;

      res.json({
        stats: [
          { label: 'Tareas Pendientes', value: pendingCount, icon: 'clock', color: 'yellow' },
          { label: 'Entregas Realizadas', value: completedCount, icon: 'check', color: 'green' },
          { label: 'Progreso General', value: `${progress}%`, icon: 'trending-up', color: 'blue' },
          { label: 'Promedio General', value: averageDisplay, icon: 'award', color: 'purple' } 
        ]
      });
      return;
    }

    // 👨‍🏫 CASO 3: TEACHER
    if (role === RoleName.TEACHER) {
       const myCourses = await prisma.course.count({ where: { teacherId: userId } });
       const myAssignments = await prisma.assignment.count({ where: { creatorId: userId } });
       const toGrade = await prisma.assignment.count({
         where: { creatorId: userId, status: 'SUBMITTED' }
       });

       const uniqueStudents = await prisma.enrollment.findMany({
         where: {
           course: { teacherId: userId }
         },
         distinct: ['studentId'],
         select: { studentId: true }
       });
       
       const totalStudentsCount = uniqueStudents.length;

       res.json({
        stats: [
            { label: 'Por Calificar', value: toGrade, icon: 'alert', color: 'red' },
            { label: 'Mis Cursos', value: myCourses, icon: 'book', color: 'blue' },
            { label: 'Tareas Creadas', value: myAssignments, icon: 'file', color: 'purple' },
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