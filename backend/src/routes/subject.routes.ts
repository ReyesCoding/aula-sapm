import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import { getAllSubjects, createSubject, joinSubject, manageEnrollment } from '../controllers/subject.controller';
const router = Router();

// GET /api/subjects - Privado (Cualquier usuario logueado puede ver las materias)
router.get('/', authenticateToken, getAllSubjects);

router.post('/', createSubject); // Si tienes ruta de crear

// POST /api/subjects/join - Privado (Estudiante se une a una materia)
router.post('/join', authenticateToken, joinSubject);

router.patch('/enrollment', authenticateToken, manageEnrollment);

export default router;