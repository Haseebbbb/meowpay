import { Router } from 'express';

import authRoute from './auth.route';
import catRoute from './cat.route';
import healthRoute from './health.route';
import transactionRoute from './transaction.route';

const router = Router();

router.use('/health', healthRoute);
router.use('/auth', authRoute);
router.use('/', catRoute);
router.use('/', transactionRoute);

export default router;
