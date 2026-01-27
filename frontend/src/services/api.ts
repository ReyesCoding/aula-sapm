import axios from 'axios';

// 1. Crear la instancia de Axios
// ⚠️ CAMBIO CRÍTICO: Cambiamos 3001 a 3000 para coincidir con server.ts
const api = axios.create({
  baseURL: 'http://localhost:3001/api', 
});

// 2. Interceptor de Solicitud (Request)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
); 

// 3. Interceptor de Respuesta (Response)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Si el error no viene del login, cerramos sesión
      if (error.config && !error.config.url.includes('/auth/login')) {
        console.warn("Sesión expirada o inválida. Cerrando sesión...");
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;