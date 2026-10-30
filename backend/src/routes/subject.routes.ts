import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';
import { getAllSubjects, createSubject, joinSubject, manageEnrollment } from '../controllers/subject.controller';
const router = Router();

// GET /api/subjects - Privado (Cualquier usuario logueado puede ver las materias)
router.get('/', authenticateToken, getAllSubjects);

// POST /api/subjects - Crear materia (Profesor, Centro o Admin)
// 🐛 FIX: antes esta ruta no tenía authenticateToken, así que req.user siempre
// era undefined y createSubject fallaba con 500 para absolutamente todos.
router.post('/', authenticateToken, authorizeRoles([RoleName.TEACHER, RoleName.CENTRO, RoleName.ADMIN]), createSubject);

// POST /api/subjects/join - Privado (Estudiante se une a una materia)
router.post('/join', authenticateToken, joinSubject);

router.patch('/enrollment', authenticateToken, manageEnrollment);

export default router;
