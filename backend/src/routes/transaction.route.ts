import { Router } from 'express';

import { transactionController } from '../controllers/transaction.controller';

const router = Router();

router.post('/topups', transactionController.topup);
router.post('/transfers', transactionController.transfer);
router.get('/transactions', transactionController.list);

export default router;
