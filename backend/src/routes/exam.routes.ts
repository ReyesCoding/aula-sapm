import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';
import { RoleName } from '@prisma/client';
import { createExam, getExamsBySubject, getExamById, submitExam } from '../controllers/exam.controller';

const router = Router();

// Rutas Profesor (Crear)
router.post('/', authenticateToken, authorizeRoles([RoleName.TEACHER, RoleName.ADMIN]), createExam);

// Rutas Públicas para el curso (Listar exámenes de una materia)
router.get('/subject/:subjectId', authenticateToken, getExamsBySubject);

// Rutas Alumno (Tomar y Enviar)
router.get('/:id', authenticateToken, getExamById); // Ver examen (sin respuestas correctas)
router.post('/submit', authenticateToken, authorizeRoles([RoleName.STUDENT]), submitExam); // Enviar respuestas

export default router;