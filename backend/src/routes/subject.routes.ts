import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';
import { getAllSubjects, createSubject, updateSubject, deleteSubject, joinSubject, manageEnrollment } from '../controllers/subject.controller';
const router = Router();

// GET /api/subjects - Privado (Cualquier usuario logueado puede ver las materias)
router.get('/', authenticateToken, getAllSubjects);

// POST /api/subjects - Crear materia (Profesor, Centro o Admin)
// 🐛 FIX: antes esta ruta no tenía authenticateToken, así que req.user siempre
// era undefined y createSubject fallaba con 500 para absolutamente todos.
router.post('/', authenticateToken, authorizeRoles([RoleName.TEACHER, RoleName.CENTRO, RoleName.ADMIN]), createSubject);

// PATCH/DELETE /api/subjects/:id - Editar / eliminar (Profesor titular, Centro de su propio centro, o Admin)
router.patch('/:id', authenticateToken, authorizeRoles([RoleName.TEACHER, RoleName.CENTRO, RoleName.ADMIN]), updateSubject);
router.delete('/:id', authenticateToken, authorizeRoles([RoleName.CENTRO, RoleName.ADMIN]), deleteSubject);

// POST /api/subjects/join - Privado (Estudiante se une a una materia)
router.post('/join', authenticateToken, joinSubject);

router.patch('/enrollment', authenticateToken, manageEnrollment);

export default router;
