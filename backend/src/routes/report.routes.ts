import { Router } from 'express';
import { generateStudentReport } from '../controllers/report.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

// GET /api/reports/student-progress?studentId=7
router.get('/student-progress', generateStudentReport);

export default router;