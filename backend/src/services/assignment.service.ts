import prisma from '../prisma/client';
import { EnrollmentStatus } from '@prisma/client';

/**
 * Vista "fusionada" de una tarea para UN alumno en particular: los datos de
 * la tarea (Assignment) más el estado de SU PROPIA entrega (Submission), si
 * existe. Antes de separar Submission (v2.1, ver CODE_REVIEW.md 10.1), estos
 * campos vivían directamente en la fila de Assignment — este tipo mantiene
 * exactamente esa misma forma "plana" para que el frontend (que ya espera
 * status/grade/feedback/submissionUrl al mismo nivel que title/dueDate) no
 * tenga que cambiar.
 */
export interface AssignmentWithOwnSubmission {
  id: number;
  title: string;
  description: string | null;
  dueDate: Date;
  attachmentUrl: string | null;
  subjectId: number;
  subject: { id: number; name: string };
  creatorId: number;
  studentId: number | null;
  courseId: number | null;
  createdAt: Date;
  updatedAt: Date;
  // Derivado de la entrega propia (o su ausencia):
  status: 'PENDING' | 'LATE' | 'SUBMITTED' | 'GRADED';
  grade: number | null;
  feedback: string | null;
  submissionUrl: string | null;
  submissionComment: string | null;
  submittedAt: Date | null;
}

/**
 * Todas las tareas visibles para un alumno (compartidas con alguna materia en
 * la que está inscrito ACTIVE, o asignadas individualmente a él), cada una
 * con el estado de SU PROPIA entrega mezclado adentro.
 *
 * Antes esta misma consulta (repetida 3 veces, ligeramente distinta, en
 * dashboard.controller.ts) filtraba directamente por `Assignment.studentId`,
 * lo que significaba que una tarea compartida con toda la materia (studentId
 * null) era INVISIBLE para el alumno hasta que alguien la "reclamaba" al
 * entregar — ni aparecía como pendiente ni contaba en sus números. Con
 * Submission separado, la visibilidad (¿quién puede ver esta tarea?) ya no
 * depende de si ya fue entregada, así que ese hueco queda cerrado también.
 */
export async function getVisibleAssignmentsForStudent(studentId: number): Promise<AssignmentWithOwnSubmission[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId, status: EnrollmentStatus.ACTIVE },
    select: { subjectId: true },
  });
  const subjectIds = enrollments.map((e) => e.subjectId);

  const assignments = await prisma.assignment.findMany({
    where: {
      OR: [{ studentId }, { subjectId: { in: subjectIds } }],
    },
    include: {
      subject: { select: { id: true, name: true } },
      submissions: { where: { studentId }, take: 1 },
    },
    orderBy: { dueDate: 'asc' },
  });

  const now = new Date();

  return assignments.map((a) => {
    const sub = a.submissions[0];
    const status: AssignmentWithOwnSubmission['status'] = sub
      ? (sub.status as 'SUBMITTED' | 'GRADED')
      : a.dueDate < now
        ? 'LATE'
        : 'PENDING';

    return {
      id: a.id,
      title: a.title,
      description: a.description,
      dueDate: a.dueDate,
      attachmentUrl: a.attachmentUrl,
      subjectId: a.subjectId,
      subject: a.subject,
      creatorId: a.creatorId,
      studentId: a.studentId,
      courseId: a.courseId,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      status,
      grade: sub?.grade ?? null,
      feedback: sub?.feedback ?? null,
      submissionUrl: sub?.submissionUrl ?? null,
      submissionComment: sub?.submissionComment ?? null,
      submittedAt: sub?.submittedAt ?? null,
    };
  });
}
