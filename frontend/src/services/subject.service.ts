import api from './api'; 

export interface Subject {
  id: number;
  name: string;
  teacher?: { id: number; name: string } | null;
  _count?: {
    assignments: number;
    exams: number;
  };
}

export const getSubjects = async (): Promise<Subject[]> => {
  const response = await api.get('/subjects');
  return response.data;
};