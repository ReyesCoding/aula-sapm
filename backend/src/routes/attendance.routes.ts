import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import {
  recordAttendance,
  getSubjectAttendanceByDate,
  getStudentSubjectAttendance,
  getStudentAttendanceHistory,
} from '../controllers/attendance.controller';

const router = Router();

router.use(authenticateToken);

router.post('/subjects/:subjectId', recordAttendance);
router.get('/subjects/:subjectId', getSubjectAttendanceByDate);
router.get('/subjects/:subjectId/students/:studentId', getStudentSubjectAttendance);
router.get('/students/:studentId/history', getStudentAttendanceHistory);

export default router;
