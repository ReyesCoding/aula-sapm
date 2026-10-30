import api from './api';

export interface EducationalCenter {
  id: number;
  name: string;
  code: string;
  logoUrl?: string | null;
  isActive: boolean;
  _count?: { users: number; subjects: number };
}

export const getCenters = async (): Promise<EducationalCenter[]> => {
  const { data } = await api.get<EducationalCenter[]>('/centers');
  return data;
};

export const createCenter = async (payload: { name: string; code: string; logoUrl?: string }): Promise<EducationalCenter> => {
  const { data } = await api.post<EducationalCenter>('/centers', payload);
  return data;
};

export const updateCenter = async (
  id: number,
  payload: { name?: string; logoUrl?: string; isActive?: boolean }
): Promise<EducationalCenter> => {
  const { data } = await api.patch<EducationalCenter>(`/centers/${id}`, payload);
  return data;
};
