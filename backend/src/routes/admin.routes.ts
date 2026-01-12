// backend/src/routes/admin.routes.ts
import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import { allowRoles } from '../middlewares/role.middleware';
import { getAdminStats, adminSearch } from '../controllers/admin.controller';

const router = Router();

// Solo Admin
router.get('/stats', authenticateToken, allowRoles('Admin'), getAdminStats);

// Admin o Centro
router.get('/search', authenticateToken, allowRoles('Admin', 'Centro'), adminSearch);

export default router;
