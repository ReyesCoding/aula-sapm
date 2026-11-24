import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { RoleName, EnrollmentStatus } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import { getVisibleAssignmentsForStudent } from '../services/assignment.service';
import { getUnreadCountForUser } from './messaging.controller';

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.userId;
    const role = authReq.user!.role;
    const now = new Date();

    // =========================================================
    // 👑 CASO 1: ADMINISTRADOR
    // =========================================================
    if (role === RoleName.ADMIN) {
      // v3.1 (feedback de producto): antes estas 4 tarjetas eran "Usuarios
      // Totales / Materias Activas / Actividades / Estado Sistema" — datos
      // operativos del DÍA A DÍA de una materia, que es justamente lo que
      // Admin NO opera (eso es trabajo de Centro/Profesor). Admin administra
      // CENTROS, así que el resumen ahora gira en torno a ellos: cuántos
      // hay, cuántos están activos, cuántos usuarios tiene la plataforma en
      // total, y cuántos "reportes" (mensajes) sin leer le han escalado los
      // centros — este último no es un número inventado: como Admin solo
      // conversa con Centro (ver messaging.policy.ts), su bandeja de no
      // leídos ES, literalmente, sus reportes pendientes de los centros.
      const [centers, totalUsers, usersByRoleRaw, unreadReports] = await Promise.all([
        prisma.educationalCenter.findMany({
          orderBy: { name: 'asc' },
          include: { _count: { select: { users: true, subjects: true } } },
        }),
        prisma.user.count(),
        prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
        getUnreadCountForUser(userId),
      ]);

      const totalCenters = centers.length;
      const activeCenters = centers.filter((c) => c.isActive).length;
      const usersByRole = usersByRoleRaw.reduce<Record<string, number>>((acc, row) => {
        acc[row.role] = row._count._all;
        return acc;
      }, {});

      res.json({
        stats: [
          { label: 'Centros Educativos', value: totalCenters, icon: 'building', color: 'indigo', type: 'admin_centers' },
          { label: 'Centros Activos', value: `${activeCenters}/${totalCenters}`, icon: 'check', color: activeCenters === totalCenters && totalCenters > 0 ? 'green' : 'orange', type: 'admin_centers' },
          { label: 'Usuarios Totales', value: totalUsers, icon: 'users', color: 'blue', type: 'admin_users' },
          { label: 'Reportes Sin Leer', value: unreadReports, icon: 'alert', color: unreadReports > 0 ? 'red' : 'gray', type: 'admin_reports' },
        ],
        details: {
          centers: centers.map((c) => ({
            id: c.id,
            name: c.name,
            code: c.code,
            isActive: c.isActive,
            usersCount: c._count.users,
            subjectsCount: c._count.subjects,
          })),
          usersByRole,
        },
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
      // v2.1: las tareas (pendientes/completadas/calificadas) se calculan UNA
      // sola vez con getVisibleAssignmentsForStudent (ver assignment.service.ts),
      // que fusiona cada tarea visible con el estado de la entrega PROPIA del
      // alumno. Antes se hacían 3 consultas casi idénticas directamente sobre
      // Assignment.studentId, lo que además tenía un bug: una tarea compartida
      // con toda la materia (studentId null) era invisible para el alumno
      // hasta que alguien la "reclamaba" al entregar — no contaba como
      // pendiente ni aparecía en la lista. Queda corregido junto con 10.1.
      const [
          visibleAssignments,
          pendingExams,
          pendingExamsCount,
          gradedExams
      ] = await Promise.all([
          getVisibleAssignmentsForStudent(userId),
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
          prisma.examSubmission.findMany({
            where: { studentId: userId }, select: { score: true }
          })
      ]);

      const pendingAssignmentsAll = visibleAssignments.filter(a => a.status === 'PENDING' || a.status === 'LATE');
      const pendingAssignments = pendingAssignmentsAll.slice(0, 5);
      const pendingAssignCount = pendingAssignmentsAll.length;
      const completedCount = visibleAssignments.filter(a => a.status === 'SUBMITTED' || a.status === 'GRADED').length;
      const gradedAssignments = visibleAssignments.filter(a => a.status === 'GRADED' && a.grade != null);

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
            pendingSubmissions,
            activeExams,
            uniqueStudentsList,
            pendingEnrollments, // 👇 Nueva consulta para aprobaciones
            toGradeCount,
            activeExamsCount,
            mySubjectsCount
        ] = await Promise.all([
            // 1. Entregas por calificar (v2.1: Submission real, ver
            // CODE_REVIEW.md 10.1 — antes esto leía Assignment.status
            // directamente, lo que solo podía reflejar la entrega de UN
            // alumno por tarea compartida).
            prisma.submission.findMany({
                where: { status: 'SUBMITTED', assignment: { creatorId: userId } },
                include: {
                    assignment: { select: { id: true, title: true, subject: { select: { name: true, id: true } } } },
                    student: { select: { name: true } }
                },
                orderBy: { submittedAt: 'asc' },
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
            prisma.submission.count({ where: { status: 'SUBMITTED', assignment: { creatorId: userId } } }),
            prisma.exam.count({ where: { teacherId: userId, OR: [{ dueDate: { gt: now } }, { dueDate: null }] } }),
            prisma.subject.count({ where: { teacherId: userId } })
        ]);

       const totalUniqueStudents = uniqueStudentsList.length;
       const pendingRequestsCount = pendingEnrollments.length;

       // Una fila por entrega pendiente (no por tarea): si 3 alumnos
       // entregaron la misma tarea compartida, aparecen 3 veces, una por
       // cada uno — es justo lo que el profesor necesita revisar. `id` se
       // mantiene como el ID de la TAREA (para el highlight/navegación en
       // SubjectDetail.tsx); `submissionId` es el identificador real de fila
       // para usar como key en la lista del frontend.
       const assignmentsToGrade = pendingSubmissions.map((s) => ({
         id: s.assignment.id,
         submissionId: s.id,
         title: s.assignment.title,
         subject: s.assignment.subject,
         student: s.student,
       }));

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
      const centerId = authReq.user!.educationalCenterId;

      const [usersCount, subjectsCount, assignmentsCount, pendingEnrollments, usersByRoleRaw] = await Promise.all([
        prisma.user.count({ where: { educationalCenterId: centerId } }),
        prisma.subject.count({ where: { educationalCenterId: centerId } }),
        prisma.assignment.count({ where: { subject: { educationalCenterId: centerId } } }),
        prisma.enrollment.count({ where: { status: EnrollmentStatus.PENDING, subject: { educationalCenterId: centerId } } }),
        prisma.user.groupBy({ by: ['role'], where: { educationalCenterId: centerId }, _count: { _all: true } }),
      ]);

      const usersByRole = usersByRoleRaw.reduce<Record<string, number>>((acc, row) => {
        acc[row.role] = row._count._all;
        return acc;
      }, {});

      res.json({
        stats: [
          { label: 'Usuarios del Centro', value: usersCount, icon: 'users', color: 'blue', type: 'centro_users' },
          { label: 'Materias Activas', value: subjectsCount, icon: 'book', color: 'green', type: 'centro_subjects' },
          { label: 'Actividades', value: assignmentsCount, icon: 'file', color: 'purple', type: 'centro_assignments' },
          { label: 'Solicitudes Pendientes', value: pendingEnrollments, icon: 'alert', color: pendingEnrollments > 0 ? 'orange' : 'gray', type: 'centro_pending' },
        ],
        details: { usersByRole },
      });
      return;
    }

    // =========================================================
    // 👪 CASO 5: PADRE/MADRE
    // =========================================================
    if (role === RoleName.PARENT) {
      const links = await prisma.parentChild.findMany({
        where: { parentId: userId },
        select: { child: { select: { id: true, name: true } } },
      });
      let childIds = links.map((l) => l.child.id);
      const totalChildrenCount = childIds.length;
      // v3.1: se agrega el listado de hijos con nombre (antes solo se
      // contaban) para que el frontend pueda ofrecer un selector de hijo
      // cuando hay 2+ — pedido explícito: "hacer referencia clara de qué
      // perfil de hijo estamos viendo". Si el frontend pide un hijo en
      // concreto (?childId=), las estadísticas (pendientes/promedio) se
      // acotan a ESE hijo en vez de mezclar a todos.
      const childrenSummary = links.map((l) => l.child);
      const { childId: requestedChildId } = req.query as { childId?: string };
      if (requestedChildId) {
        const requested = Number(requestedChildId);
        if (childIds.includes(requested)) {
          childIds = [requested];
        }
      }

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

      // v2.1: igual que en el dashboard del propio alumno, se usa
      // getVisibleAssignmentsForStudent por cada hijo en vez de filtrar
      // Assignment.studentId directamente (mismo motivo: antes una tarea
      // compartida con la materia era invisible hasta que alguien la
      // "reclamaba" al entregar).
      const [childAssignmentsPerChild, gradedExams] = await Promise.all([
        Promise.all(childIds.map((childId) => getVisibleAssignmentsForStudent(childId))),
        prisma.examSubmission.findMany({ where: { studentId: { in: childIds } }, select: { score: true } }),
      ]);

      const childAssignments = childAssignmentsPerChild.flat();
      const pendingCount = childAssignments.filter((a) => a.status === 'PENDING' || a.status === 'LATE').length;
      const gradedAssignments = childAssignments.filter((a) => a.status === 'GRADED' && a.grade != null);

      const allGrades = [...gradedAssignments.map((a) => a.grade ?? 0), ...gradedExams.map((e) => e.score ?? 0)];
      let averageDisplay = '-';
      if (allGrades.length > 0) {
        const sum = allGrades.reduce((a, b) => a + b, 0);
        averageDisplay = (sum / allGrades.length).toFixed(1).replace(/\.0$/, '');
      }

      res.json({
        stats: [
          { label: 'Hijos Vinculados', value: totalChildrenCount, icon: 'users', color: 'blue', type: totalChildrenCount > 1 ? 'parent_children' : undefined },
          { label: 'Actividades Pendientes', value: pendingCount, icon: 'clock', color: pendingCount > 0 ? 'orange' : 'green' },
          { label: 'Promedio General', value: averageDisplay, icon: 'award', color: 'purple' },
        ],
        details: { children: childrenSummary },
      });
      return;
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error obteniendo estadísticas' });
  }
};