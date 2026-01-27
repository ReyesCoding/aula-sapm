import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';
import { RoleName } from '@prisma/client';
import { 
    createExam, 
    getExamsBySubject, 
    getExamById, 
    submitExam,
    getExamSubmissions,
    toggleExamVisibility 
} from '../controllers/exam.controller';

const router = Router();

// 1. RUTAS DE CREACIÓN Y CONFIGURACIÓN (Estáticas)
// Crear examen (Profesor)
router.post('/', authenticateToken, authorizeRoles([RoleName.TEACHER, RoleName.ADMIN]), createExam);

// Enviar respuestas (Alumno) - Esta debe ir antes de cualquier /:id
router.post('/submit', authenticateToken, authorizeRoles([RoleName.STUDENT]), submitExam);

// 2. RUTAS DE LISTADOS
// Listar exámenes por materia
router.get('/subject/:subjectId', authenticateToken, getExamsBySubject);

// 3. RUTAS ESPECÍFICAS CON ID (Deben ir ANTES de la ruta genérica /:id)
// 👇 Ver resultados (Profesor) - ¡ESTA ES LA PRIORIDAD!
router.get('/:id/submissions', authenticateToken, authorizeRoles([RoleName.TEACHER, RoleName.ADMIN]), getExamSubmissions);

// 👇 Switch de visibilidad (Profesor)
router.patch('/:id/toggle-visibility', authenticateToken, authorizeRoles([RoleName.TEACHER, RoleName.ADMIN]), toggleExamVisibility);

// 4. RUTA GENÉRICA (El "Comodín")
// Ver examen individual (Captura cualquier ID simple, por eso va AL FINAL)
router.get('/:id', authenticateToken, getExamById);

export default router;  