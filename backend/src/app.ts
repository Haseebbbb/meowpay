/// <reference path="./types/express.d.ts" />
// The line above is a compile-time-only hint, not an import: express.d.ts is a
// pure `declare global` augmentation (adds `req.cat`) with no runtime JS to
// require. ts-node only type-checks files it reaches via require/import —
// unlike `tsc --noEmit`, which eagerly includes everything matching tsconfig
// `include` — so without this reference the augmentation is invisible under
// ts-node even though `npm run typecheck` sees it fine.
import express, { type Express } from 'express';

import routes from './routes';
import { authenticate } from './middleware/authenticate';
import { errorHandler } from './middleware/error-handler';
import { notFound } from './middleware/not-found';

/**
 * Builds the configured Express application. Deliberately does not call
 * `listen` so it can be imported directly by tests.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(authenticate);
  app.use('/', routes);

  // Order matters: 404 first, then the terminal error handler.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
