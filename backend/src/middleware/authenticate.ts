import type { NextFunction, Request, Response } from 'express';

import type { AuthenticatedCat } from '../models';
import { verifyAuthToken } from '../utils/jwt';
import { HttpError } from './http-error';

interface PublicRoute {
  method: string;
  path: string;
}

// Requests matching one of these exactly skip authentication entirely. Keep
// this list in sync with any route that must be reachable without a token —
// notably signup/login themselves, which can't require what they issue.
const PUBLIC_ROUTES: readonly PublicRoute[] = [
  { method: 'GET', path: '/health' },
  { method: 'POST', path: '/auth/signup' },
  { method: 'POST', path: '/auth/login' },
];

function isPublicRoute(req: Request): boolean {
  return PUBLIC_ROUTES.some((route) => route.method === req.method && route.path === req.path);
}

/**
 * Global gate: every request must carry a valid `Authorization: Bearer <jwt>`
 * header unless its method+path is in PUBLIC_ROUTES. On success the decoded
 * { id, name, email } is attached to `req.cat` for downstream handlers.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  if (isPublicRoute(req)) {
    next();
    return;
  }

  const [scheme, token] = (req.header('authorization') ?? '').split(' ');

  if (scheme !== 'Bearer' || !token) {
    next(HttpError.unauthorized('Missing or malformed Authorization header'));
    return;
  }

  try {
    req.cat = verifyAuthToken(token);
    next();
  } catch {
    next(HttpError.unauthorized('Invalid or expired token'));
  }
}

/**
 * Every non-public route sits behind `authenticate`, so `req.cat` is always
 * set by the time a handler runs — this just gives that invariant a name and
 * a safe failure mode instead of a silent `req.cat!` non-null assertion.
 */
export function requireAuthenticatedCat(req: Request): AuthenticatedCat {
  if (!req.cat) {
    throw HttpError.unauthorized('Authentication required');
  }
  return req.cat;
}
