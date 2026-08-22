import type { NextFunction, Request, Response } from 'express';

import { HttpError } from './http-error';

/**
 * Mounted after all routes: any request reaching this point matched nothing.
 * Hands off to the error handler so 404s share the error response shape.
 */
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(HttpError.notFound(`Cannot ${req.method} ${req.originalUrl}`));
}
