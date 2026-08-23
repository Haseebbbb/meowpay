import { Router } from 'express';

import authRoute from './auth.route';
import healthRoute from './health.route';

const router = Router();

router.use('/health', healthRoute);
router.use('/auth', authRoute);

export default router;
