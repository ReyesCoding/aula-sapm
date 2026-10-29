import axios from 'axios';

// 1. Crear la instancia de Axios
// Bloque 7 (deployment): baseURL relativa en vez de "http://localhost:3001" fijo.
// En dev, el proxy de Vite (ver vite.config.ts) redirige /api al backend local.
// En producción (Docker), nginx hace lo mismo dentro del contenedor del frontend.
// Mismo código en los dos entornos, sin variables de entorno que mantener sincronizadas.
const api = axios.create({
  baseURL: '/api',
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
    // Solo 401: token ausente/inválido/expirado -> no autenticado, cerrar sesión.
    // 403 es "autenticado pero sin permiso para ESTA acción" (rol incorrecto,
    // centro distinto, etc.) y no debe cerrar la sesión completa - eso
    // convertiría cualquier error de permisos puntual en una desconexión
    // confusa. authenticateToken (backend) devuelve 401 para token
    // inválido/expirado específicamente por esto.
    if (error.response && error.response.status === 401) {
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