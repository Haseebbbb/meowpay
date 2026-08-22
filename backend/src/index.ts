import type { Server } from 'node:http';

import { createApp } from './app';
import { closeDatabase } from './config/database';
import { env } from './config/env';

const app = createApp();

const server: Server = app.listen(env.port, () => {
  console.log(`[meowpay] listening on http://localhost:${env.port} (${env.nodeEnv})`);
});

let shuttingDown = false;

/**
 * Stop accepting connections, then drain the Knex pool. Without this the
 * container hangs on open sockets until Docker's stop timeout kills it.
 */
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  console.log(`[meowpay] ${signal} received, shutting down`);

  server.close(async (closeError) => {
    if (closeError) {
      console.error('[meowpay] error closing HTTP server:', closeError);
    }

    try {
      await closeDatabase();
    } catch (error) {
      console.error('[meowpay] error closing database pool:', error);
    }

    process.exit(closeError ? 1 : 0);
  });

  // Backstop in case a connection refuses to drain.
  setTimeout(() => {
    console.error('[meowpay] forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
