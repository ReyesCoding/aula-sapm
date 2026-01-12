import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import path from 'path';

// Imports locales
import { errorHandler } from './middlewares/error.middleware';
import prisma from './prisma/client'; // Usamos la instancia compartida

// Rutas
import authRoutes from './routes/auth.routes';
import assignmentRoutes from './routes/assignment.routes';

// Configuración
dotenv.config();
const app = express();
const PORT = Number(process.env.PORT) || 3001;

// --------------------------------------------------------
// 🛡️ MIDDLEWARES
// --------------------------------------------------------

app.use(express.json());

// Helmet configurado para permitir cargar recursos (imágenes/pdf) desde otros orígenes
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" } 
}));

// Configuración de CORS
const ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// --------------------------------------------------------
// 📂 ARCHIVOS ESTÁTICOS
// --------------------------------------------------------

// Servir carpeta uploads públicamente
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// --------------------------------------------------------
// 🚦 RUTAS
// --------------------------------------------------------

// Health Check (Base de datos y servidor)
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (err: any) {
    return res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// Root Ping
app.get('/', (_req, res) => {
  res.send('🚀 Aula SAPM API v1.0 funcionando correctamente.');
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/assignments', assignmentRoutes);

// --------------------------------------------------------
// ⚠️ MANEJO DE ERRORES (Siempre al final)
// --------------------------------------------------------

// 404 - No Encontrado
app.use((_req, res) => {
  return res.status(404).json({ message: 'Ruta no encontrada' });
});

// Manejador Global de Errores
app.use(errorHandler);

// --------------------------------------------------------
// 🚀 SERVER START
// --------------------------------------------------------

app.listen(PORT, () => {
  console.log(`\n⚡ Servidor corriendo en: http://localhost:${PORT}`);
  console.log(`📂 Archivos públicos en: http://localhost:${PORT}/uploads/\n`);
  
  // Log de rutas montadas para debug rápido
  console.log('✅ Rutas API activas:');
  console.log('   - /api/auth');
  console.log('   - /api/assignments');
});