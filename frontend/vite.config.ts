import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bloque 7 (deployment): mismo patrón que nginx usa en producción (ver
    // frontend/nginx.conf) — /api y /uploads se redirigen al backend, así el
    // código de la app siempre usa rutas relativas, nunca "http://localhost:3001".
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
})
