import { Router, Request, Response, NextFunction } from 'express';
import { 
  createAssignment, 
  getAssignments, 
  updateAssignment, 
  deleteAssignment, 
  submitAssignment,
  gradeAssignment
} from '../controllers/assignment.controller';
// 👇 CORRECCIÓN 1: Usamos el nombre correcto de tu middleware
import { authenticateToken } from '../middlewares/auth.middleware';
import { authorizeRoles } from '../middlewares/role.middleware';
import { RoleName } from '@prisma/client';
// 👇 CORRECCIÓN 2: Usamos llaves {} porque es un export nombrado (export const upload)
import { upload } from '../middlewares/upload.middleware';
import { MulterError } from 'multer';

const router = Router();

// 👇 WRAPPER DE SEGURIDAD PARA SUBIDAS
// Atrapa errores de Multer (ej: archivo muy grande o tipo incorrecto) antes de que rompan el servidor
const uploadSafe = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err instanceof MulterError) {
        return res.status(400).json({ message: `Error de subida: ${err.message}` });
      }
      // Error personalizado (ej: "Solo se permiten PDFs")
      return res.status(400).json({ message: err.message || 'Error al procesar el archivo' });
    }
    next();
  });
};

// Rutas
router.use(authenticateToken); // 👈 Usamos la función correcta aquí

// Obtener tareas
router.get('/', getAssignments);

// Crear tarea (Solo Profesor)
router.post('/', authorizeRoles([RoleName.TEACHER]), uploadSafe, createAssignment);

// Editar tarea
router.patch('/:id', authorizeRoles([RoleName.TEACHER]), uploadSafe, updateAssignment);

// Borrar tarea
router.delete('/:id', authorizeRoles([RoleName.TEACHER]), deleteAssignment);

// Entregar tarea (Estudiante)
router.post('/:id/submit', authorizeRoles([RoleName.STUDENT]), uploadSafe, submitAssignment);

// Calificar tarea (Profesor)
router.patch('/:id/grade', authorizeRoles([RoleName.TEACHER]), gradeAssignment);

export default router;