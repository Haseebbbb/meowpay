import jwt from 'jsonwebtoken';

import { env } from '../config/env';
import type { AuthenticatedCat } from '../models';

export function signAuthToken(cat: AuthenticatedCat): string {
  return jwt.sign(cat, env.jwtSecret, { expiresIn: env.jwtExpiresInSeconds });
}

/**
 * Verifies signature and expiry, then narrows the decoded payload to the
 * shape we actually signed. Throws on anything else (bad signature, expired,
 * unexpected payload shape) — callers treat any throw as "unauthenticated".
 */
export function verifyAuthToken(token: string): AuthenticatedCat {
  const decoded = jwt.verify(token, env.jwtSecret);

  if (typeof decoded !== 'object' || decoded === null) {
    throw new Error('Unexpected JWT payload');
  }

  const { id, name, email } = decoded as Record<string, unknown>;

  if (typeof id !== 'string' || typeof name !== 'string' || typeof email !== 'string') {
    throw new Error('Unexpected JWT payload');
  }

  return { id, name, email };
}
