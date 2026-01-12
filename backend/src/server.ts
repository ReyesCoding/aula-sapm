import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import assignmentRoutes from './routes/assignment.routes'; 
import dashboardRoutes from './routes/dashboard.routes'; 
import reportRoutes from './routes/report.routes'; 
import path from 'path'; 
import courseRoutes from './routes/course.routes'; 
import userRoutes from './routes/users.routes';

// Configuración de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 🛡️ Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// ✅ Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'OK', 
    project: 'Aula - Student Assignment Manager', 
    timestamp: new Date() 
  });
});

// ✅ Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/assignments', assignmentRoutes); 
app.use('/api/dashboard', dashboardRoutes); 
app.use('/api/reports', reportRoutes); 
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/api/courses', courseRoutes); 
app.use('/api/users', userRoutes); 

//  Manejo de Errores Global
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ 
    status: 'error', 
    message: 'Internal Server Error' 
  });
});

//  Iniciar Servidor
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor Aula corriendo en: http://localhost:${PORT}`);
  console.log(`👉 Health check: http://localhost:${PORT}/api/health`);
  console.log(`👉 Auth Routes: http://localhost:${PORT}/api/auth`);
  console.log(`👉 Assignment Routes: http://localhost:${PORT}/api/assignments\n`);
});