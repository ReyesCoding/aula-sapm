import api from './api';
import type { DashboardStats } from '../types/dashboard.types'; // 👈 Agrega "type" aquí
//import { DashboardStats } from '../types/dashboard.types';

export const getDashboardStats = async (childId?: number | null): Promise<DashboardStats> => {
  const { data } = await api.get<DashboardStats>('/dashboard/stats', {
    params: childId ? { childId } : undefined,
  });
  return data;
};