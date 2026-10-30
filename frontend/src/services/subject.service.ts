import api from './api';

export interface Subject {
  id: number;
  name: string;
  code?: string;
  description?: string | null;
  teacherId?: number;
  teacher?: { id: number; name: string } | null;
  _count?: {
    assignments: number;
    exams: number;
    enrollments?: number;
  };
}

export const getSubjects = async (): Promise<Subject[]> => {
  const response = await api.get('/subjects');
  return response.data;
};

export interface CreateSubjectPayload {
  name: string;
  code: string;
  description?: string;
  /** Obligatorio si quien crea es CENTRO o ADMIN (el profesor titular). Ignorado si quien crea es TEACHER. */
  teacherId?: number;
  /** Obligatorio si quien crea es ADMIN (no pertenece a ningún centro por sí mismo). */
  educationalCenterId?: number;
}

export const createSubject = async (payload: CreateSubjectPayload): Promise<Subject> => {
  const { data } = await api.post<Subject>('/subjects', payload);
  return data;
};

export const joinSubjectByCode = async (code: string): Promise<{ message: string }> => {
  const { data } = await api.post<{ message: string }>('/subjects/join', { code });
  return data;
};

export const manageSubjectEnrollment = async (
  enrollmentId: number,
  status: 'ACTIVE' | 'REJECTED'
): Promise<{ message: string }> => {
  const { data } = await api.patch<{ message: string }>('/subjects/enrollment', { enrollmentId, status });
  return data;
};
