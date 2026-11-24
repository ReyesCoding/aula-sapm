import api from './api';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT' | 'CENTRO' | 'PARENT';
  isActive: boolean;
  createdAt: string;
}

export interface ChildSummary {
  id: number;
  name: string;
  email: string;
}

export interface UpdateProfileData {
  name: string;
  currentPassword?: string; // Opcional, solo si quiere cambiar pass
  newPassword?: string;     // Opcional
}

// Obtener todos (o filtrados por rol: Centro usa esto para separar
// Profesores/Estudiantes/Padres en su propia UI en vez de una lista mezclada).
export const getAllUsers = async (role?: string) => {
  const { data } = await api.get<User[]>('/users', { params: role ? { role } : undefined });
  return data;
};

// Crear
export const createUser = async (userData: {
  name: string;
  email: string;
  password: string;
  role: string;
  educationalCenterId?: number;
}) => {
  const { data } = await api.post('/users', userData);
  return data;
};

// Actualizar (nombre/email/contraseña) — Admin: cualquiera. Centro: solo
// profesores de su propio centro (ver users.controller.ts::updateUser).
export const updateUser = async (id: number, payload: { name?: string; email?: string; password?: string }) => {
  const { data } = await api.patch(`/users/${id}`, payload);
  return data;
};

// Eliminar
export const deleteUser = async (id: number) => {
  const { data } = await api.delete(`/users/${id}`);
  return data;
};

// --- v3.1: Centro matricula un Estudiante + le asigna Padre/Madre ---
export interface CreateStudentWithParentPayload {
  studentName: string;
  studentEmail: string;
  studentPassword: string;
  parentMode: 'new' | 'existing' | 'none';
  parentName?: string;
  parentEmail?: string;
  parentPassword?: string;
  existingParentId?: number;
}

export const createStudentWithParent = async (payload: CreateStudentWithParentPayload) => {
  const { data } = await api.post('/users/students-with-parent', payload);
  return data as { student: User; parent: User | null };
};

export const getStudentParents = async (studentId: number): Promise<ChildSummary[]> => {
  const { data } = await api.get<ChildSummary[]>(`/users/${studentId}/parents`);
  return data;
};

export const addParentToStudent = async (
  studentId: number,
  payload: { parentMode: 'new' | 'existing'; parentName?: string; parentEmail?: string; parentPassword?: string; existingParentId?: number }
) => {
  const { data } = await api.post(`/users/${studentId}/parents`, payload);
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

// --- Vínculo Padre/Madre -> Hijo (Solo Admin) ---
export const getParentChildren = async (parentId: number): Promise<ChildSummary[]> => {
  const { data } = await api.get<ChildSummary[]>(`/users/${parentId}/children`);
  return data;
};

export const linkChild = async (parentId: number, childId: number) => {
  const { data } = await api.post(`/users/${parentId}/children`, { childId });
  return data;
};

export const unlinkChild = async (parentId: number, childId: number) => {
  const { data } = await api.delete(`/users/${parentId}/children/${childId}`);
  return data;
};
