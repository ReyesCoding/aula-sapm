import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';
import { 
  getAllUsers, 
  createUser, 
  deleteUser, 
  searchUsers, 
  updateUserRole,
  updateProfile,
  linkParentChild,
  unlinkParentChild,
  getParentChildren
} from '../controllers/users.controller';
import { RoleName } from '@prisma/client';

const router = Router();

// 1. RUTAS PÚBLICAS (para cualquier usuario logueado)
// Deben ir ANTES del bloqueo de Admin.
router.patch('/profile', authenticateToken, updateProfile);

// 🔒 Hallazgo nuevo (ver comentario en users.controller.ts::searchUsers):
// antes CUALQUIER rol autenticado (incluyendo STUDENT/PARENT) podía llamar
// esto sin ningún filtro de centro. Los únicos 2 usos reales en el frontend
// son el selector de profesor al crear materia (TEACHER/CENTRO/ADMIN) y la
// vinculación de hijos (ADMIN) — restringimos a esos roles.
router.get('/search', authenticateToken, authorizeRoles([RoleName.TEACHER, RoleName.CENTRO, RoleName.ADMIN]), searchUsers);

// 2. MIDDLEWARE DE SEGURIDAD (Muro de contención)
// De aquí para abajo, SOLO pasan los ADMINS.
router.use(authenticateToken, authorizeRoles([RoleName.ADMIN]));

// 3. RUTAS PROTEGIDAS (Solo Admin)
router.get('/', getAllUsers);          
router.post('/', createUser);          
router.delete('/:id', deleteUser);     
router.patch('/:id/role', updateUserRole);

// 4. Vínculo Padre/Madre -> Hijo (Solo Admin)
router.get('/:id/children', getParentChildren);
router.post('/:id/children', linkParentChild);
router.delete('/:id/children/:childId', unlinkParentChild);

export default router;
