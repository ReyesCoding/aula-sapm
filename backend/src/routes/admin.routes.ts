// backend/src/routes/admin.routes.ts
import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';
import { getAdminStats, adminSearch } from '../controllers/admin.controller';

const router = Router();

// Solo Admin (plataforma)
router.get('/stats', authenticateToken, authorizeRoles([RoleName.ADMIN]), getAdminStats);

// Admin o Centro
router.get('/search', authenticateToken, authorizeRoles([RoleName.ADMIN, RoleName.CENTRO]), adminSearch);

export default router;
