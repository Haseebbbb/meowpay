import type { AuthenticatedCat } from '../models';

declare global {
  namespace Express {
    interface Request {
      /** Set by the `authenticate` middleware once a request's JWT verifies. */
      cat?: AuthenticatedCat;
    }
  }
}

export {};
