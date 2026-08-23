import type { NextFunction, Request, Response } from 'express';

import { requireAuthenticatedCat } from '../middleware/authenticate';
import { catService } from '../services/cat.service';

export const catController = {
  async search(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { id: requesterId } = requireAuthenticatedCat(req);
    const rawQuery = req.query['q'];
    const query = typeof rawQuery === 'string' ? rawQuery : '';

    const results = await catService.search(query, requesterId);
    res.status(200).json(results);
  },

  async me(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { id: catId } = requireAuthenticatedCat(req);

    const result = await catService.getMe(catId);
    res.status(200).json(result);
  },
};
