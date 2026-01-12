import api from './api';

export interface Course {
  id: number;
  name: string;
  code: string;
  description?: string;
  teacherId: number;
  subjectId: number;
  // 👇 AQUÍ ESTÁ LA CLAVE: Definir que teacher y subject tienen ID
  teacher: {
    id: number;     // 👈 Faltaba esto
    name: string;
    email: string;
  };
  subject: {
    id: number;     // 👈 Asegúrate que este también esté
    name: string;
  };
  _count?: {
    students: number;
  };
}

export const getCourses = async (): Promise<Course[]> => {
  const { data } = await api.get<Course[]>('/courses');
  return data;
};

export const createCourse = async (courseData: { 
  name: string; 
  description: string; 
  code: string; 
  subjectId: number; 
  teacherId: number; 
}) => {
  const { data } = await api.post('/courses', courseData);
  return data;
};

export const enrollStudent = async (courseId: number, studentId: number) => {
  const { data } = await api.post('/courses/enroll', { courseId, studentId });
  return data;
};