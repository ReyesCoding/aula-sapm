import axios from 'axios';

// 1. Crear la instancia de Axios con la URL base de tu backend
const api = axios.create({
  baseURL: 'http://localhost:3001/api', // Asegúrate de que este puerto coincida con tu backend
});

// 2. Interceptor de Solicitud (Request)
// Antes de que salga la petición, le pegamos el token
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
// Si el backend nos responde 401 o 403 (Token vencido/invalido), limpiamos todo
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Si el error no viene del login (porque si fallas login es normal tener 401)
      if (!error.config.url.includes('/auth/login')) {
        console.warn("Sesión expirada o inválida. Cerrando sesión...");
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Opcional: Redirigir al login forzosamente
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;