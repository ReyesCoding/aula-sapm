import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import {
  createEvaluation,
  listEvaluations,
  updateEvaluation,
  deleteEvaluation,
  getSubjectAverage,
  getStudentHistory,
  listPeriods,
  createPeriod,
} from '../controllers/grades.controller';

const router = Router();

router.use(authenticateToken);

router.get('/periods', listPeriods);
router.post('/periods', createPeriod);

router.post('/subjects/:subjectId/evaluations', createEvaluation);
router.get('/subjects/:subjectId/evaluations', listEvaluations);
router.get('/subjects/:subjectId/average', getSubjectAverage);

router.patch('/evaluations/:id', updateEvaluation);
router.delete('/evaluations/:id', deleteEvaluation);

router.get('/students/:studentId/history', getStudentHistory);

export default router;
