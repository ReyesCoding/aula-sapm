import api from './api';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  isActive: boolean;
  createdAt: string;
}

export interface UpdateProfileData {
  name: string;
  currentPassword?: string; // Opcional, solo si quiere cambiar pass
  newPassword?: string;     // Opcional
}

// Obtener todos
export const getAllUsers = async () => {
  const { data } = await api.get<User[]>('/users');
  return data;
};

// Crear
export const createUser = async (userData: { name: string, email: string, password: string, role: string }) => {
  const { data } = await api.post('/users', userData);
  return data;
};

// Eliminar
export const deleteUser = async (id: number) => {
  const { data } = await api.delete(`/users/${id}`);
  return data;
};

// Buscar (Para dropdowns futuros)
export const searchUsers = async (query: string, role: string = 'STUDENT') => {
  // Llamamos al backend: /users/search?query=juan&role=STUDENT
  const { data } = await api.get<User[]>('/users/search', { 
    params: { query, role } 
  });
  return data;
};

export const updateProfile = async (data: UpdateProfileData) => {
  const response = await api.patch<User>('/users/profile', data);
  return response.data;
};