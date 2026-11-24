import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';
import { 
  getAllUsers, 
  createUser, 
  updateUser,
  deleteUser, 
  searchUsers, 
  updateUserRole,
  updateProfile,
  linkParentChild,
  unlinkParentChild,
  getParentChildren,
  createStudentWithParent,
  addParentToStudent,
  getStudentParents
} from '../controllers/users.controller';
import { RoleName } from '@prisma/client';

const router = Router();

// 1. RUTAS PÚBLICAS (para cualquier usuario logueado)
// Deben ir ANTES del bloqueo de roles.
router.patch('/profile', authenticateToken, updateProfile);

// 🔒 Hallazgo nuevo (ver comentario en users.controller.ts::searchUsers):
// antes CUALQUIER rol autenticado (incluyendo STUDENT/PARENT) podía llamar
// esto sin ningún filtro de centro. Los únicos usos reales en el frontend
// son el selector de profesor al crear materia (TEACHER/CENTRO/ADMIN) y la
// vinculación de hijos (ADMIN) — restringimos a esos roles.
router.get('/search', authenticateToken, authorizeRoles([RoleName.TEACHER, RoleName.CENTRO, RoleName.ADMIN]), searchUsers);

// 2. GESTIÓN DE USUARIOS (Admin: todos los roles/centros. Centro: solo
// profesores de su propio centro — el controller aplica ese alcance,
// igual patrón que subject.controller.ts::createSubject).
router.get('/', authenticateToken, authorizeRoles([RoleName.ADMIN, RoleName.CENTRO]), getAllUsers);
router.post('/', authenticateToken, authorizeRoles([RoleName.ADMIN, RoleName.CENTRO]), createUser);
router.patch('/:id', authenticateToken, authorizeRoles([RoleName.ADMIN, RoleName.CENTRO]), updateUser);
router.delete('/:id', authenticateToken, authorizeRoles([RoleName.ADMIN, RoleName.CENTRO]), deleteUser);

// v3.1: Centro matricula estudiantes y les asigna padre/madre (ver
// users.controller.ts::createStudentWithParent para el razonamiento).
router.post('/students-with-parent', authenticateToken, authorizeRoles([RoleName.ADMIN, RoleName.CENTRO]), createStudentWithParent);
router.get('/:studentId/parents', authenticateToken, authorizeRoles([RoleName.ADMIN, RoleName.CENTRO]), getStudentParents);
router.post('/:studentId/parents', authenticateToken, authorizeRoles([RoleName.ADMIN, RoleName.CENTRO]), addParentToStudent);

// Listar los hijos de un padre/madre (ParentsManagement.tsx de Centro, y
// el flujo de vínculo de Admin): Centro queda acotado a su propio centro
// dentro del controller, igual patrón que el resto de este archivo.
router.get('/:id/children', authenticateToken, authorizeRoles([RoleName.ADMIN, RoleName.CENTRO]), getParentChildren);

// 3. MURO DE CONTENCIÓN: de aquí para abajo, solo Admin — cambiar el ROL de
// un usuario (riesgo de escalamiento de privilegios) y vincular/desvincular
// padres con hijos siguen siendo exclusivamente operaciones de plataforma.
router.use(authenticateToken, authorizeRoles([RoleName.ADMIN]));

router.patch('/:id/role', updateUserRole);
router.post('/:id/children', linkParentChild);
router.delete('/:id/children/:childId', unlinkParentChild);

export default router;
