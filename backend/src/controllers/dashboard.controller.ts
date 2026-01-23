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
      
      // --- CONSULTAS PARALELAS PARA OPTIMIZAR ---
      
      // 1. TAREAS
      const pendingAssignmentsPromise = prisma.assignment.count({
        where: { 
            studentId: userId,
            status: { in: ['PENDING', 'LATE'] } 
        }
      });

      const completedAssignmentsPromise = prisma.assignment.count({
        where: { 
            studentId: userId,
            status: { in: ['SUBMITTED', 'GRADED'] } 
        }
      });

      // 2. EXÁMENES (Lógica compleja para saber pendientes)
      // Primero: ¿En qué cursos estoy?
      const myEnrollmentsPromise = prisma.enrollment.findMany({
        where: { studentId: userId },
        select: { courseId: true }
      });

      // Segundo: ¿Cuántos exámenes he hecho?
      const myExamSubmissionsPromise = prisma.examSubmission.count({
        where: { studentId: userId }
      });

      // 3. CALIFICACIONES
      const gradedAssignmentsPromise = prisma.assignment.findMany({
        where: { studentId: userId, status: 'GRADED', grade: { not: null } },
        select: { grade: true }
      });

      const gradedExamsPromise = prisma.examSubmission.findMany({
        where: { studentId: userId },
        select: { score: true }
      });

      // EJECUTAMOS TODO JUNTO 🚀
      const [
        pendingAssignments, 
        completedAssignments, 
        myEnrollments, 
        myExamSubmissions,
        gradedAssignments,
        gradedExams
      ] = await Promise.all([
        pendingAssignmentsPromise,
        completedAssignmentsPromise,
        myEnrollmentsPromise,
        myExamSubmissionsPromise,
        gradedAssignmentsPromise,
        gradedExamsPromise
      ]);

      // --- PROCESAMIENTO DE DATOS ---

      // Calcular Exámenes Disponibles Totales en mis cursos
      const myCourseIds = myEnrollments.map(e => e.courseId);
      const totalExamsAvailable = await prisma.exam.count({
        where: { subjectId: { in: myCourseIds } }
      });

      // Exámenes Pendientes = Disponibles - Realizados
      const pendingExams = Math.max(0, totalExamsAvailable - myExamSubmissions);

      // Totales Finales
      const totalPending = pendingAssignments + pendingExams;
      const totalCompleted = completedAssignments + myExamSubmissions;

      // Cálculo de Promedio
      const allGrades: number[] = [
        ...gradedAssignments.map(a => a.grade ?? 0), 
        ...gradedExams.map(e => e.score ?? 0)       
      ];

      let averageDisplay = "-";
      if (allGrades.length > 0) {
        const sum = allGrades.reduce((a, b) => a + b, 0);
        const avg = sum / allGrades.length;
        averageDisplay = avg.toFixed(1).replace(/\.0$/, ''); // "85.0" -> "85"
      }

      // Progreso Visual
      const totalActivities = totalPending + totalCompleted;
      const progress = totalActivities > 0 ? Math.round((totalCompleted / totalActivities) * 100) : 0;

      res.json({
        stats: [
          { label: 'Actividades Pendientes', value: totalPending, icon: 'clock', color: 'yellow' },
          { label: 'Entregas Realizadas', value: totalCompleted, icon: 'check', color: 'green' },
          { label: 'Progreso General', value: `${progress}%`, icon: 'trending-up', color: 'blue' },
          { label: 'Promedio General', value: averageDisplay, icon: 'award', color: 'purple' } 
        ]
      });
      return;
    }

    // 👨‍🏫 CASO 3: TEACHER
    if (role === RoleName.TEACHER) {
       // Consultas en paralelo
       const myCoursesPromise = prisma.course.count({ where: { teacherId: userId } });
       const myAssignmentsPromise = prisma.assignment.count({ where: { creatorId: userId } });
       
       // Tareas por calificar
       const assignmentsToGradePromise = prisma.assignment.count({
         where: { creatorId: userId, status: 'SUBMITTED' }
       });

       // Alumnos únicos
       const uniqueStudentsPromise = prisma.enrollment.findMany({
         where: { course: { teacherId: userId } },
         distinct: ['studentId'],
         select: { studentId: true }
       });

       // Exámenes realizados (Podrías querer saber cuántos hay para revisar)
       const examsToReviewPromise = prisma.examSubmission.count({
            where: { exam: { teacherId: userId } } // Asumiendo que Exam tiene teacherId
       });

       const [myCourses, myAssignments, assignmentsToGrade, uniqueStudents, examsToReview] = await Promise.all([
            myCoursesPromise,
            myAssignmentsPromise,
            assignmentsToGradePromise,
            uniqueStudentsPromise,
            examsToReviewPromise
       ]);
       
       const totalToReview = assignmentsToGrade + examsToReview;

       res.json({
        stats: [
            { label: 'Por Revisar', value: totalToReview, icon: 'alert', color: 'red' },
            { label: 'Mis Cursos', value: myCourses, icon: 'book', color: 'blue' },
            { label: 'Tareas Creadas', value: myAssignments, icon: 'file', color: 'purple' },
            { label: 'Alumnos Totales', value: uniqueStudents.length, icon: 'users', color: 'green' }
        ]
      });
      return;
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
};