import api from './api';

export interface SubjectStudent {
  id: number;
  name: string;
  email: string;
}

export interface Evaluation {
  id: number;
  subjectId: number;
  studentId: number;
  teacherId: number;
  periodId: number | null;
  title: string;
  score: number;
  weight: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  student?: { id: number; name: string };
}

export type GradeSource = 'ASSIGNMENT' | 'EXAM' | 'EVALUATION';

export interface GradeBreakdownItem {
  source: GradeSource;
  id: number;
  label: string;
  score: number;
  weight: number;
}

export interface SubjectAverageResult {
  subjectId: number;
  studentId: number;
  average: number | null;
  breakdown: GradeBreakdownItem[];
}

interface CreateEvaluationData {
  studentId: number;
  title: string;
  score: number;
  weight?: number;
  comment?: string;
  periodId?: number;
}

// Profesor: roster de alumnos activos de la materia (para elegir a quién calificar)
export const getSubjectStudents = async (subjectId: number): Promise<SubjectStudent[]> => {
  const { data } = await api.get<SubjectStudent[]>(`/grades/subjects/${subjectId}/students`);
  return data;
};

// Profesor (sin studentId, ve todas con { student }) o Alumno (ve las suyas)
export const getSubjectEvaluations = async (subjectId: number, studentId?: number): Promise<Evaluation[]> => {
  const { data } = await api.get<Evaluation[]>(`/grades/subjects/${subjectId}/evaluations`, {
    params: studentId ? { studentId } : undefined,
  });
  return data;
};

export const createEvaluation = async (subjectId: number, payload: CreateEvaluationData): Promise<Evaluation> => {
  const { data } = await api.post<Evaluation>(`/grades/subjects/${subjectId}/evaluations`, payload);
  return data;
};

export const deleteEvaluation = async (id: number): Promise<void> => {
  await api.delete(`/grades/evaluations/${id}`);
};

// studentId es obligatorio para profesor/otros roles; el alumno ve siempre la suya (se ignora)
export const getSubjectAverage = async (subjectId: number, studentId?: number): Promise<SubjectAverageResult> => {
  const { data } = await api.get<SubjectAverageResult>(`/grades/subjects/${subjectId}/average`, {
    params: studentId ? { studentId } : undefined,
  });
  return data;
};
