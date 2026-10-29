import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import {
  createThread,
  listThreads,
  getThread,
  createPost,
  setThreadLock,
  setThreadPin,
  deletePost,
} from '../controllers/forum.controller';

const router = Router();

router.use(authenticateToken);

router.post('/subjects/:subjectId/threads', createThread);
router.get('/subjects/:subjectId/threads', listThreads);
router.get('/threads/:id', getThread);
router.post('/threads/:id/posts', createPost);
router.patch('/threads/:id/lock', setThreadLock);
router.patch('/threads/:id/pin', setThreadPin);
router.delete('/posts/:id', deletePost);

export default router;
