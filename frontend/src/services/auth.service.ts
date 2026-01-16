import api from './api'; 

interface LoginCredentials {
  email?: string;
  password?: string;
}

interface LoginResponse {
  token: string;
  user: {
    id: number;
    email: string;
    name: string;
    role: string;
  };
}

export const login = async (credentials: LoginCredentials) => {
  // 👇 Llamada real al Backend
  const response = await api.post<LoginResponse>('/auth/login', credentials);
  return response.data;
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const getProfile = async () => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};