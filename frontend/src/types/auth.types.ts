// Definimos los roles igual que en el backend
export type RoleName = 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';

export interface User {
  id: number;
  name: string;
  email: string;
  role: RoleName;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: User;
}