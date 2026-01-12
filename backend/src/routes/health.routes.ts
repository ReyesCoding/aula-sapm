import { Router } from 'express';
import { getHealth, getVersion } from '../controllers/health.controller';

const router = Router();

router.get('/health', getHealth);
router.get('/version', getVersion);

export default router;
