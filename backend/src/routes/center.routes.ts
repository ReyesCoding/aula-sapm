import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';
import {
  createCenter,
  listCenters,
  getCenter,
  updateCenter,
  assignUserToCenter,
} from '../controllers/center.controller';

const router = Router();

router.use(authenticateToken);

// Cualquier usuario logueado puede ver el detalle de SU propio centro (chequeo en el controller)
router.get('/:id', getCenter);

// El resto es exclusivo de ADMIN (rol de plataforma)
router.use(authorizeRoles([RoleName.ADMIN]));

router.post('/', createCenter);
router.get('/', listCenters);
router.patch('/:id', updateCenter);
router.post('/:id/assign-user', assignUserToCenter);

export default router;
