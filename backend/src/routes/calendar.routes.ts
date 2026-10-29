import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import { listEvents, createEvent, updateEvent, deleteEvent } from '../controllers/calendar.controller';

const router = Router();

router.use(authenticateToken);

router.get('/events', listEvents);
router.post('/events', createEvent);
router.patch('/events/:id', updateEvent);
router.delete('/events/:id', deleteEvent);

export default router;
