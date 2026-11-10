import prisma from '../prisma/client';
import { AssignmentStatus, EnrollmentStatus } from '@prisma/client';

/**
 * Cálculo de promedios (Bloque 3, v2.0). Combina tres fuentes de nota por
 * materia en un único promedio ponderado:
 *   1) Submission (entregas de tareas) ya calificadas (status GRADED, grade
 *      no nulo). v2.1 (CODE_REVIEW.md 10.1, resuelto): antes esto leía
 *      Assignment.grade directamente y SOLO podía incluir tareas asignadas
 *      individualmente a ese alumno — una tarea "para toda la materia"
 *      compartía una sola fila sin nota por-alumno, así que quedaba afuera
 *      del promedio aunque el alumno la hubiera entregado y la hubieran
 *      calificado. Con la entrega en su propia tabla, toda tarea calificada
 *      de ese alumno entra al promedio, compartida o individual.
 *   2) ExamSubmission (exámenes respondidos), normalizado a una escala 0-100
 *      usando la suma de puntos de las preguntas del examen.
 *   3) Evaluation (notas manuales del profesor), con su propio peso.
 * Cada fuente aporta su score (0-100) y weight al promedio ponderado final.
 */

export type GradeSource = 'ASSIGNMENT' | 'EXAM' | 'EVALUATION';

export interface GradeBreakdownItem {
  source: GradeSource;
  id: number;
  label: string;
  score: number; // normalizado 0-100
  weight: number;
}

export interface SubjectAverageResult {
  subjectId: number;
  studentId: number;
  average: number | null;
  breakdown: GradeBreakdownItem[];
}

export async function computeSubjectAverage(studentId: number, subjectId: number): Promise<SubjectAverageResult> {
  const breakdown: GradeBreakdownItem[] = [];

  // 1) Entregas de tareas calificadas de este alumno en esta materia.
  const submissions = await prisma.submission.findMany({
    where: {
      studentId,
      status: AssignmentStatus.GRADED,
      grade: { not: null },
      assignment: { subjectId },
    },
    select: { id: true, grade: true, assignment: { select: { title: true } } },
  });
  for (const s of submissions) {
    breakdown.push({ source: 'ASSIGNMENT', id: s.id, label: s.assignment.title, score: s.grade as number, weight: 1 });
  }

  // 2) Exámenes respondidos de esta materia.
  const submissions = await prisma.examSubmission.findMany({
    where: { studentId, score: { not: null }, exam: { subjectId } },
    include: { exam: { include: { questions: { select: { points: true } } } } },
  });
  for (const s of submissions) {
    const totalPoints = s.exam.questions.reduce((sum, q) => sum + q.points, 0);
    if (totalPoints > 0 && s.score != null) {
      const normalized = (s.score / totalPoints) * 100;
      breakdown.push({ source: 'EXAM', id: s.id, label: s.exam.title, score: normalized, weight: 1 });
    }
  }

  // 3) Evaluaciones manuales del profesor.
  const evaluations = await prisma.evaluation.findMany({
    where: { studentId, subjectId },
    select: { id: true, title: true, score: true, weight: true },
  });
  for (const e of evaluations) {
    breakdown.push({ source: 'EVALUATION', id: e.id, label: e.title, score: e.score, weight: e.weight });
  }

  if (breakdown.length === 0) {
    return { subjectId, studentId, average: null, breakdown };
  }

  const totalWeight = breakdown.reduce((sum, b) => sum + b.weight, 0);
  const weightedSum = breakdown.reduce((sum, b) => sum + b.score * b.weight, 0);
  const average = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : null;

  return { subjectId, studentId, average, breakdown };
}

export interface StudentHistorySubject {
  subjectId: number;
  subjectName: string;
  subjectCode: string;
  average: number | null;
  breakdown: GradeBreakdownItem[];
}

export interface StudentHistoryResult {
  studentId: number;
  subjects: StudentHistorySubject[];
  overallAverage: number | null;
}

/**
 * Historial académico de un alumno: el promedio por cada materia donde tiene
 * una inscripción ACTIVE, más un promedio general (media simple de los
 * promedios de materia que sí tienen nota — no pondera por cantidad de notas
 * entre materias, cada materia cuenta igual).
 */
export async function computeStudentHistory(studentId: number): Promise<StudentHistoryResult> {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId, status: EnrollmentStatus.ACTIVE },
    include: { subject: { select: { id: true, name: true, code: true } } },
  });

  const subjects: StudentHistorySubject[] = await Promise.all(
    enrollments.map(async (e) => {
      const result = await computeSubjectAverage(studentId, e.subjectId);
      return {
        subjectId: e.subjectId,
        subjectName: e.subject.name,
        subjectCode: e.subject.code,
        average: result.average,
        breakdown: result.breakdown,
      };
    })
  );

  const gradedSubjects = subjects.filter((s): s is StudentHistorySubject & { average: number } => s.average != null);
  const overallAverage = gradedSubjects.length
    ? Math.round((gradedSubjects.reduce((sum, s) => sum + s.average, 0) / gradedSubjects.length) * 10) / 10
    : null;

  return { studentId, subjects, overallAverage };
}
