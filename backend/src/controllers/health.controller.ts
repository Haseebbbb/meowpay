import type { NextFunction, Request, Response } from 'express';

import { healthService } from '../services/health.service';

/**
 * Translates between HTTP and the service layer. No business rules, no Knex.
 * Express 5 forwards rejected promises to the error middleware, so async
 * handlers need no try/catch — `next` stays in the signature for explicit calls.
 */
export const healthController = {
  async getHealth(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    const health = await healthService.getHealth();

    // 503 tells load balancers and orchestrators to stop routing traffic here.
    res.status(health.status === 'ok' ? 200 : 503).json(health);
  },
};
