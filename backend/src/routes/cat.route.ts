import { Router } from 'express';

import { catController } from '../controllers/cat.controller';

const router = Router();

// Grouped by domain (cat identity), not by URL prefix — /me isn't nested
// under /cats but belongs with search as "things about the current/other cats".
router.get('/cats/search', catController.search);
router.get('/me', catController.me);

export default router;
