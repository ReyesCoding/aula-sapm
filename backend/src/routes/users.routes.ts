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

// 1. RUTAS PÚBLICAS (Para cualquier usuario logueado: Admin, Teacher, Student)
// Deben ir ANTES del bloqueo de Admin.
router.get('/search', authenticateToken, searchUsers);
router.patch('/profile', authenticateToken, updateProfile);

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
