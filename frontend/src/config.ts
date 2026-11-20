// Bloque 7 (deployment): URL base absoluta del backend.
//
// Vacía por defecto: en dev el proxy de Vite redirige /api y /uploads al
// backend local (ver vite.config.ts), y en el despliegue de VPS con nginx
// frontend y backend comparten el mismo origen - en ambos casos las rutas
// relativas ya funcionan sin tocar nada.
//
// En Render (frontend y backend en subdominios distintos de onrender.com)
// no hay un origen compartido, así que ahí sí hace falta la URL completa
// del backend. Se define en build time con VITE_API_URL en el Static Site
// de Render, ej: https://aula-sapm-api.onrender.com
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';
