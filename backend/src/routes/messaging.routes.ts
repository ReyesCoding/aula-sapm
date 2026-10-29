import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import {
  getContacts,
  createConversation,
  listConversations,
  getConversation,
  sendMessage,
  markConversationRead,
  archiveConversation,
  getGlobalUnreadCount,
} from '../controllers/messaging.controller';

const router = Router();

router.use(authenticateToken);

router.get('/contacts', getContacts);
router.get('/unread-count', getGlobalUnreadCount);

router.post('/conversations', createConversation);
router.get('/conversations', listConversations);
router.get('/conversations/:id', getConversation);
router.post('/conversations/:id/messages', sendMessage);
router.patch('/conversations/:id/read', markConversationRead);
router.patch('/conversations/:id/archive', archiveConversation);

export default router;
