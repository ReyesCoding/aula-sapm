import api from './api'; 

export interface Subject {
  id: number;
  name: string;
  _count?: {
    assignments: number;
    exams: number;
  };
}

export const getSubjects = async (): Promise<Subject[]> => {
  const response = await api.get('/subjects');
  return response.data;
};