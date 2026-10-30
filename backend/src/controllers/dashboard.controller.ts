import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { RoleName, EnrollmentStatus } from '@prisma/client';

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const role = (req as any).user?.role as RoleName;
    const now = new Date();

    // =========================================================
    // 👑 CASO 1: ADMINISTRADOR
    // =========================================================
    if (role === RoleName.ADMIN) {
      const [users, subjects, assignments] = await Promise.all([
        prisma.user.count(),
        prisma.subject.count(),
        prisma.assignment.count()
      ]);

      res.json({
        stats: [
          { label: 'Usuarios Totales', value: users, icon: 'users', color: 'blue', type: 'admin_users' },
          { label: 'Materias Activas', value: subjects, icon: 'book', color: 'green', type: 'admin_courses' },
          { label: 'Actividades', value: assignments, icon: 'file', color: 'purple', type: 'admin_reports' },
          { label: 'Estado Sistema', value: 'OK', icon: 'check', color: 'gray', type: 'system_status' }
        ]
      });
      return;
    }

    // =========================================================
    // 🎓 CASO 2: ESTUDIANTE
    // =========================================================
    if (role === RoleName.STUDENT) {
      
      // 1. Obtener Inscripciones ACTIVAS (Solo materias donde fue aceptado)
      const myEnrollments = await prisma.enrollment.findMany({
        where: { 
            studentId: userId,
            status: EnrollmentStatus.ACTIVE 
        },
        select: { subjectId: true }
      });
      
      const mySubjectIds = myEnrollments.map(e => e.subjectId);

      // 2. Ejecutar consultas en paralelo para velocidad
      const [
          pendingAssignments,
          completedCount,
          pendingAssignCount,
          pendingExams,
          pendingExamsCount,
          gradedAssignments,
          gradedExams
      ] = await Promise.all([
          // A. Tareas Pendientes (Lista)
          prisma.assignment.findMany({
            where: { 
                studentId: userId,
                status: { in: ['PENDING', 'LATE'] } 
            },
            include: { subject: { select: { name: true, id: true } } },
            orderBy: { dueDate: 'asc' },
            take: 5
          }),
          // B. Tareas Completadas (Count)
          prisma.assignment.count({
            where: { studentId: userId, status: { in: ['SUBMITTED', 'GRADED'] } }
          }),
          // C. Tareas Pendientes (Count)
          prisma.assignment.count({
            where: { studentId: userId, status: { in: ['PENDING', 'LATE'] } }
          }),
          // D. Exámenes Pendientes (Lista)
          prisma.exam.findMany({
            where: {
                subjectId: { in: mySubjectIds },
                submissions: { none: { studentId: userId } },
                OR: [{ dueDate: { gt: now } }, { dueDate: null }]
            },
            include: { subject: { select: { name: true, id: true } } },
            orderBy: { dueDate: 'asc' },
            take: 5
          }),
          // E. Exámenes Pendientes (Count)
          prisma.exam.count({
             where: { 
                subjectId: { in: mySubjectIds },
                submissions: { none: { studentId: userId } }, 
                OR: [{ dueDate: { gt: now } }, { dueDate: null }] 
             }
          }),
          // F. Calificaciones (Para promedio)
          prisma.assignment.findMany({
            where: { studentId: userId, status: 'GRADED', grade: { not: null } }, select: { grade: true }
          }),
          prisma.examSubmission.findMany({
            where: { studentId: userId }, select: { score: true }
          })
      ]);

      // 3. Cálculos de UI
      const totalPending = pendingAssignCount + pendingExamsCount;
      
      // Cálculo de Promedio
      const allGrades = [...gradedAssignments.map(a => a.grade ?? 0), ...gradedExams.map(e => e.score ?? 0)];
      let averageDisplay = "-";
      if (allGrades.length > 0) {
        const sum = allGrades.reduce((a, b) => a + b, 0);
        averageDisplay = (sum / allGrades.length).toFixed(1).replace(/\.0$/, '');
      }

      // Cálculo de Progreso
      const totalCompletedActivities = completedCount + gradedExams.length; 
      const totalActivities = totalPending + totalCompletedActivities;
      const progress = totalActivities > 0 ? Math.round((totalCompletedActivities / totalActivities) * 100) : 0;

      res.json({
        stats: [
          { label: 'Por Hacer', value: totalPending, icon: 'clock', color: 'orange', type: 'student_pending' },
          { label: 'Completado', value: totalCompletedActivities, icon: 'check', color: 'green', type: 'student_completed' },
          { label: 'Promedio', value: averageDisplay, icon: 'award', color: 'purple', subtext: 'Global', type: 'student_average' },
          { label: 'Progreso', value: `${progress}%`, icon: 'trending-up', color: 'blue', type: 'student_progress' }
        ],
        details: {
            pendingAssignments,
            pendingExams
        }
      });
      return;
    }

    // =========================================================
    // 👨‍🏫 CASO 3: PROFESOR
    // =========================================================
    if (role === RoleName.TEACHER) {
       
        // Ejecutar consultas pesadas en paralelo
        const [
            assignmentsToGrade,
            activeExams,
            uniqueStudentsList,
            pendingEnrollments, // 👇 Nueva consulta para aprobaciones
            toGradeCount,
            activeExamsCount,
            mySubjectsCount
        ] = await Promise.all([
            // 1. Tareas por calificar
            prisma.assignment.findMany({
                where: { creatorId: userId, status: 'SUBMITTED' },
                include: { 
                    subject: { select: { name: true, id: true } },
                    student: { select: { name: true } }
                },
                take: 10
            }),
            // 2. Exámenes activos
            prisma.exam.findMany({
                where: { teacherId: userId, OR: [{ dueDate: { gt: now } }, { dueDate: null }] },
                include: { 
                    subject: { select: { name: true, id: true } },
                    _count: { select: { submissions: true } }
                 }
            }),
            // 3. Alumnos Activos (Solo ACCEPTED)
            prisma.enrollment.findMany({
                where: { 
                    subject: { teacherId: userId },
                    status: EnrollmentStatus.ACTIVE 
                },
                distinct: ['studentId'],
                select: {
                   student: { select: { id: true, name: true, email: true } },
                   subject: { select: { name: true } }
                }
            }),
            // 4. Solicitudes Pendientes (NEW!)
            prisma.enrollment.findMany({
                where: { 
                    subject: { teacherId: userId },
                    status: EnrollmentStatus.PENDING 
                },
                include: {
                    student: { select: { name: true, email: true } },
                    subject: { select: { name: true } }
                }
            }),
            // 5. Contadores
            prisma.assignment.count({ where: { creatorId: userId, status: 'SUBMITTED' } }),
            prisma.exam.count({ where: { teacherId: userId, OR: [{ dueDate: { gt: now } }, { dueDate: null }] } }),
            prisma.subject.count({ where: { teacherId: userId } })
        ]);

       const totalUniqueStudents = uniqueStudentsList.length;
       const pendingRequestsCount = pendingEnrollments.length;

       res.json({
        stats: [
            { label: 'Por Revisar', value: toGradeCount, icon: 'alert', color: 'red', type: 'teacher_review' }, 
            { label: 'Exámenes Activos', value: activeExamsCount, icon: 'brain', color: 'purple', type: 'teacher_exams' },
            // 👇 Si hay solicitudes pendientes, mostramos alerta naranja, si no, mostramos alumnos azules
            pendingRequestsCount > 0 
                ? { label: 'Solicitudes', value: pendingRequestsCount, icon: 'user-plus', color: 'orange', type: 'teacher_requests' }
                : { label: 'Mis Alumnos', value: totalUniqueStudents, icon: 'users', color: 'blue', type: 'teacher_students' },
            { label: 'Materias', value: mySubjectsCount, icon: 'book', color: 'green', type: 'teacher_courses' }
        ],
        details: {
            assignmentsToGrade,
            activeExams,
            uniqueStudents: uniqueStudentsList,
            pendingEnrollments // Enviamos data para el modal
        }
      });
      return;
    }

    // =========================================================
    // 🏫 CASO 4: CENTRO
    // =========================================================
    // 🐛 FIX: antes no existía este caso ni el de PARENT, así que para esos
    // dos roles la función llegaba al final sin llamar res.json/res.status
    // ninguna vez — la petición se quedaba colgada para siempre y el
    // dashboard de Centro/Padre nunca terminaba de cargar.
    if (role === RoleName.CENTRO) {
      const centerId = (req as any).user?.educationalCenterId as number | null;

      const [usersCount, subjectsCount, assignmentsCount, pendingEnrollments] = await Promise.all([
        prisma.user.count({ where: { educationalCenterId: centerId } }),
        prisma.subject.count({ where: { educationalCenterId: centerId } }),
        prisma.assignment.count({ where: { subject: { educationalCenterId: centerId } } }),
        prisma.enrollment.count({ where: { status: EnrollmentStatus.PENDING, subject: { educationalCenterId: centerId } } }),
      ]);

      res.json({
        stats: [
          { label: 'Usuarios del Centro', value: usersCount, icon: 'users', color: 'blue' },
          { label: 'Materias Activas', value: subjectsCount, icon: 'book', color: 'green' },
          { label: 'Actividades', value: assignmentsCount, icon: 'file', color: 'purple' },
          { label: 'Solicitudes Pendientes', value: pendingEnrollments, icon: 'alert', color: pendingEnrollments > 0 ? 'orange' : 'gray' },
        ],
      });
      return;
    }

    // =========================================================
    // 👪 CASO 5: PADRE/MADRE
    // =========================================================
    if (role === RoleName.PARENT) {
      const links = await prisma.parentChild.findMany({ where: { parentId: userId }, select: { childId: true } });
      const childIds = links.map((l) => l.childId);

      if (childIds.length === 0) {
        res.json({
          stats: [
            { label: 'Hijos Vinculados', value: 0, icon: 'users', color: 'gray' },
            { label: 'Actividades Pendientes', value: 0, icon: 'clock', color: 'gray' },
            { label: 'Promedio General', value: '-', icon: 'award', color: 'gray' },
          ],
          details: { children: [] },
        });
        return;
      }

      const [pendingCount, gradedAssignments, gradedExams] = await Promise.all([
        prisma.assignment.count({ where: { studentId: { in: childIds }, status: { in: ['PENDING', 'LATE'] } } }),
        prisma.assignment.findMany({
          where: { studentId: { in: childIds }, status: 'GRADED', grade: { not: null } },
          select: { grade: true },
        }),
        prisma.examSubmission.findMany({ where: { studentId: { in: childIds } }, select: { score: true } }),
      ]);

      const allGrades = [...gradedAssignments.map((a) => a.grade ?? 0), ...gradedExams.map((e) => e.score ?? 0)];
      let averageDisplay = '-';
      if (allGrades.length > 0) {
        const sum = allGrades.reduce((a, b) => a + b, 0);
        averageDisplay = (sum / allGrades.length).toFixed(1).replace(/\.0$/, '');
      }

      res.json({
        stats: [
          { label: 'Hijos Vinculados', value: childIds.length, icon: 'users', color: 'blue' },
          { label: 'Actividades Pendientes', value: pendingCount, icon: 'clock', color: pendingCount > 0 ? 'orange' : 'green' },
          { label: 'Promedio General', value: averageDisplay, icon: 'award', color: 'purple' },
        ],
      });
      return;
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
};