import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

// Importación de Rutas
import authRoutes from './routes/auth.routes';
import assignmentRoutes from './routes/assignment.routes';
import dashboardRoutes from './routes/dashboard.routes';
import reportRoutes from './routes/report.routes';
import courseRoutes from './routes/course.routes';
import userRoutes from './routes/users.routes';
import subjectRoutes from './routes/subject.routes';
import examRoutes from './routes/exam.routes';
import centerRoutes from './routes/center.routes';
import messagingRoutes from './routes/messaging.routes';
import notificationRoutes from './routes/notification.routes';
import adminRoutes from './routes/admin.routes';
import forumRoutes from './routes/forum.routes';
import gradesRoutes from './routes/grades.routes';
import attendanceRoutes from './routes/attendance.routes';

// Configuración de entorno
dotenv.config();

const app = express();
// Usamos el puerto que definas en .env o el 3000 por defecto (el frontend suele llamar al 3000)
const PORT = Number(process.env.PORT) || 3000;

// 🛡️ Middlewares de Seguridad y Logs
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" } // Permite cargar imágenes/archivos
}));

// Configuración CORS Permisiva para Desarrollo (Permite Frontend Vite)
app.use(cors({
  origin: true, // Acepta cualquier origen en dev (útil para localhost)
  credentials: true
}));

app.use(morgan('dev')); // Log de peticiones en consola
app.use(express.json()); // Parsing de JSON

// 📂 Archivos Estáticos (Uploads)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ✅ Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    project: 'Aula - Student Assignment Manager',
    timestamp: new Date().toISOString()
  });
});

// ✅ RUTAS DE LA API (El orden importa)
app.use('/api/auth', authRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/users', userRoutes);
app.use('/api/subjects', subjectRoutes);

// 👇 AQUÍ ESTÁ LA CLAVE: Montamos las rutas de exámenes
app.use('/api/exams', examRoutes);

// v2.0: Multi-centro + Centro de Mensajería + Notificaciones + Admin
app.use('/api/centers', centerRoutes);
app.use('/api/messages', messagingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/forums', forumRoutes);
app.use('/api/grades', gradesRoutes);
app.use('/api/attendance', attendanceRoutes);

// ⚠️ Manejo de Errores Global (Siempre al final)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("❌ Error del Servidor:", err.stack);
  res.status(500).json({
    status: 'error',
    message: err.message || 'Internal Server Error'
  });
});

// 404 - Ruta no encontrada (Para APIs que no existen)
app.use((req, res) => {
  res.status(404).json({ message: `Ruta ${req.originalUrl} no encontrada` });
});

// 🚀 Iniciar Servidor
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor Aula corriendo en: http://localhost:${PORT}`);
  console.log(`👉 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📂 Uploads: http://localhost:${PORT}/uploads`);
  console.log(`✅ EXAMS API: http://localhost:${PORT}/api/exams\n`);
});
