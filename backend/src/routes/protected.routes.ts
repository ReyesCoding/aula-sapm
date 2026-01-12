import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import { authorizeRoles } from '../middlewares/role.middleware';
import { RoleName } from '@prisma/client';

const router = Router();

router.get('/admin-only', authenticateToken, authorizeRoles([RoleName.ADMIN]), (req, res) => {
  res.json({
    message: 'Acceso permitido. Eres un Admin.',
    user: req.user
  });
});

export default router;  
