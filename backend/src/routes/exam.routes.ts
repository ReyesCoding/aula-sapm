import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';
import { RoleName } from '@prisma/client';
import { 
    createExam, 
    getExamsBySubject, 
    getExamById, 
    submitExam, 
    getExamResults, 
    toggleExamResults // 👈 Antes se llamaba toggleExamVisibility
} from '../controllers/exam.controller';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Rutas de Exámenes
// v2.0: solo quien puede impartir/gestionar materias puede crear exámenes (mismo criterio que subject.routes.ts)
router.post('/', authorizeRoles([RoleName.TEACHER, RoleName.CENTRO, RoleName.ADMIN]), createExam); // Crear examen
router.get('/subject/:subjectId', getExamsBySubject); // Listar por materia
router.get('/:id', getExamById); // Ver detalle / Responder
// v2.0: solo un STUDENT puede responder un examen (TEACHER/CENTRO/ADMIN no tienen inscripción que calificar)
router.post('/submit', authorizeRoles([RoleName.STUDENT]), submitExam); // Enviar respuestas

// Rutas de Profesor
router.get('/:id/results', getExamResults); // Ver notas de alumnos
router.patch('/:id/toggle', toggleExamResults); // Activar/Desactivar revisión

export default router;