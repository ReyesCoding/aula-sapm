import { Router, Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';
import { RoleName } from '@prisma/client';

// Controladores
import { 
  createAssignment, 
  getAssignments, 
  getAssignmentById,
  updateAssignment, 
  deleteAssignment, 
  submitAssignment,
  gradeAssignment,
  getSubmissionsByAssignment
} from '../controllers/assignment.controller';

// Middlewares
import { authenticateToken } from '../middlewares/auth.middleware';
import { authorizeRoles } from '../middlewares/role.middleware';
import { upload } from '../middlewares/upload.middleware';

const router = Router();

/**
 * Middleware Wrapper para manejar errores de Multer de forma elegante.
 * Evita que el servidor se rompa si el archivo es muy grande o el formato es incorrecto.
 */
const uploadSafe = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err instanceof MulterError) {
        // Errores específicos de Multer (ej: File too large)
        return res.status(400).json({ message: `Error de subida: ${err.message}` });
      }
      // Otros errores (ej: validación de tipo de archivo)
      return res.status(400).json({ message: err.message || 'Error al procesar el archivo' });
    }
    next();
  });
};

// 🔒 Todas las rutas requieren autenticación
router.use(authenticateToken);

// ==========================================
// 1. RUTAS GENERALES (Colección)
// ==========================================

// Obtener todas las tareas (Filtradas por rol/materia en el controlador)
router.get('/', getAssignments);

// Crear una nueva tarea (Solo Profesores)
router.post(
  '/', 
  authorizeRoles([RoleName.TEACHER]), 
  uploadSafe, 
  createAssignment
);

// ==========================================
// 2. RUTAS POR ID (Recurso Individual)
// ==========================================

// Obtener detalles de una tarea específica
router.get('/:id', getAssignmentById);

// Editar tarea (Solo el Profesor creador)
router.patch(
  '/:id', 
  authorizeRoles([RoleName.TEACHER]), 
  uploadSafe, 
  updateAssignment
);

// Eliminar tarea (Solo el Profesor creador)
router.delete(
  '/:id', 
  authorizeRoles([RoleName.TEACHER]), 
  deleteAssignment
);

// ==========================================
// 3. ACCIONES ESPECÍFICAS (Sub-recursos)
// ==========================================

// Ver entregas de una tarea (Para el modal de gestión del profesor)
router.get('/:id/submissions', getSubmissionsByAssignment);

// Entregar tarea (Solo Estudiantes)
router.post(
  '/:id/submit', 
  authorizeRoles([RoleName.STUDENT]), 
  uploadSafe, 
  submitAssignment
);

// Calificar tarea (Solo Profesores)
router.patch(
  '/:id/grade', 
  authorizeRoles([RoleName.TEACHER]), 
  gradeAssignment
);

export default router;