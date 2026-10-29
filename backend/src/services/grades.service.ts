import prisma from '../prisma/client';
import { AssignmentStatus, EnrollmentStatus } from '@prisma/client';

/**
 * Cálculo de promedios (Bloque 3, v2.0). Combina tres fuentes de nota por
 * materia en un único promedio ponderado:
 *   1) Assignment (tareas) ya calificadas (status GRADED, grade no nulo),
 *      SOLO las asignadas específicamente a ese alumno (studentId = studentId).
 *      Las tareas "para toda la materia" (studentId null) comparten una sola
 *      fila sin un campo de nota por-alumno en el modelo actual, así que no
 *      se pueden promediar de forma individual con los datos existentes.
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

  // 1) Tareas calificadas, asignadas directamente a este alumno.
  const assignments = await prisma.assignment.findMany({
    where: { subjectId, studentId, status: AssignmentStatus.GRADED, grade: { not: null } },
    select: { id: true, title: true, grade: true },
  });
  for (const a of assignments) {
    breakdown.push({ source: 'ASSIGNMENT', id: a.id, label: a.title, score: a.grade as number, weight: 1 });
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
