import type { NextFunction, Request, Response } from 'express';

import { env } from '../config/env';
import { HttpError } from './http-error';

/**
 * Terminal error middleware. Express identifies it by its four-argument
 * signature, so `next` must stay in the list even though it is only used to
 * delegate to the default handler once headers are already sent.
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof Error ? error.message : 'Internal Server Error';

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, error);
  }

  res.status(status).json({
    error: {
      status,
      ...(error instanceof HttpError && error.code ? { code: error.code } : {}),
      // Never leak internals of an unexpected failure to clients in production.
      message: status >= 500 && env.isProduction ? 'Internal Server Error' : message,
      ...(env.isProduction || !(error instanceof Error) ? {} : { stack: error.stack }),
    },
  });
}
