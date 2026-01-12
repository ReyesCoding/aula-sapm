import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import { authorizeRoles } from '../middlewares/role.middleware'; // 👈 Corregido: authorizeRoles
import { getMyPerformance, getStudentProfile, getMyUpcoming } from '../controllers/student.controller';
import { RoleName } from '@prisma/client'; // 👈 Corregido: Usamos el Enum real

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Perfil y Rendimiento (Generalmente para estudiantes, pero validamos token)
router.get('/my-performance', authorizeRoles([RoleName.STUDENT]), getMyPerformance);
router.get('/profile', authorizeRoles([RoleName.STUDENT]), getStudentProfile);

// Próximos eventos (Solo Estudiantes)
router.get('/my-upcoming', authorizeRoles([RoleName.STUDENT]), getMyUpcoming);

export default router;