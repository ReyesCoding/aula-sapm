import { Router, Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';
import { authenticateToken } from '../middlewares/auth.middleware';
import { upload } from '../middlewares/upload.middleware';
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

// Bloque 6: adjunto opcional al responder un mensaje (campo "file"). Mismo
// wrapper que assignment.routes.ts / documents.routes.ts para errores de Multer legibles.
const uploadSafe = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err instanceof MulterError) {
        return res.status(400).json({ message: `Error de subida: ${err.message}` });
      }
      return res.status(400).json({ message: err.message || 'Error al procesar el archivo' });
    }
    next();
  });
};

const router = Router();

router.use(authenticateToken);

router.get('/contacts', getContacts);
router.get('/unread-count', getGlobalUnreadCount);

router.post('/conversations', createConversation);
router.get('/conversations', listConversations);
router.get('/conversations/:id', getConversation);
router.post('/conversations/:id/messages', uploadSafe, sendMessage);
router.patch('/conversations/:id/read', markConversationRead);
router.patch('/conversations/:id/archive', archiveConversation);

export default router;
