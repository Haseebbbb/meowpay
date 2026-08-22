import express, { type Express } from 'express';

import routes from './routes';
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

  app.use('/', routes);

  // Order matters: 404 first, then the terminal error handler.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
