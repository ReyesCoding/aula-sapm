// task.routes.ts
import { Router } from 'express';
import { createTask, getTasksByStudent } from '../controllers/task.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { getMyTasks } from '../controllers/task.controller';
import { completeTask } from '../controllers/task.controller';



const router = Router();

// ⛔️ Elimina el prefijo '/tasks' aquí
router.post('/', authenticateToken, createTask);
router.get('/:studentId', authenticateToken, getTasksByStudent);
router.get('/my-tasks', authenticateToken, getMyTasks);
router.patch('/:id/complete', authenticateToken, completeTask);

export default router;
