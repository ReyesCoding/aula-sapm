import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import { allowRoles } from '../middlewares/role.middleware';
import { getMySubjects } from '../controllers/subject.controller';
import { getTasksBySubject } from '../controllers/subject.controller';
import { getTasksByWeekForSubject } from '../controllers/task.controller';
import { assignStudentToSubject } from '../controllers/subject.controller';
import { assignTeacherToSubject } from '../controllers/subject.controller';
import { createSubject } from '../controllers/subject.controller';

const router = Router();

router.get('/my-subjects', authenticateToken, getMySubjects);
router.get('/:subjectId/tasks', authenticateToken, getTasksBySubject);
router.get('/:id/tasks-by-week', authenticateToken, getTasksByWeekForSubject);

// ⬇️ CAMBIOS:
// 1) Path en inglés y con :id para que funcione /subjects/6/assign-student
// 2) Protegido con roles (Admin, Centro)
router.post('/:id/assign-student', authenticateToken, allowRoles('Admin','Centro'), assignStudentToSubject);

// 3) También protegemos assign-teacher con roles (Admin, Centro)
router.post('/:id/assign-teacher', authenticateToken, allowRoles('Admin', 'Centro'), assignTeacherToSubject);

// Crear materia (ya estaba correcto)
router.post('/', authenticateToken, allowRoles('Admin', 'Centro'), createSubject);

export default router;
