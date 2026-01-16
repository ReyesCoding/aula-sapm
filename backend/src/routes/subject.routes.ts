import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import { getAllSubjects } from '../controllers/subject.controller';

const router = Router();

// GET /api/subjects - Privado (Cualquier usuario logueado puede ver las materias)
router.get('/', authenticateToken, getAllSubjects);

export default router;