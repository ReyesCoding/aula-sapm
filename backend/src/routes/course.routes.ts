import { Router } from 'express';
import { createCourse, getCourses, enrollStudent } from '../controllers/course.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { authorizeRoles } from '../middlewares/role.middleware';
import { RoleName } from '@prisma/client';

const router = Router();

router.use(authenticateToken);

// Ver Cursos (Todos pueden ver, pero filtrado por su rol en el controlador)
router.get('/', getCourses);

// Crear Curso (SOLO ADMIN) 🔒
router.post('/', authorizeRoles([RoleName.ADMIN]), createCourse);

// Inscribir alumno (ADMIN y TEACHER)
// Damos permiso al Teacher también por si necesita agregar a alguien manual, 
// pero principalmente es tarea administrativa.
router.post('/enroll', authorizeRoles([RoleName.ADMIN, RoleName.TEACHER]), enrollStudent);

export default router;