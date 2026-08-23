// Jest `setupFiles` entry: runs inside each test worker before any test file
// (and therefore before `src/config/env.ts`'s own dotenv.config() call). Loads
// `.env` if DATABASE_URL isn't already set — e.g. docker-compose injects it as
// a real environment variable for the backend container, in which case this
// dotenv call is a no-op, exactly the behavior we want — then repoints
// whichever DATABASE_URL is now active at a dedicated test database.
//
// This is deliberately NOT a separate .env.test file with its own hardcoded
// host: "localhost" only resolves from the host machine, but inside the
// backend container Postgres is reachable at "db". Swapping just the
// database name on top of the connection string that's already correct for
// wherever this is running makes the same `npm run test:integration` work
// unchanged on the host or via `docker compose exec backend`.
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });

const baseUrl = process.env.DATABASE_URL;
if (!baseUrl) {
  throw new Error('DATABASE_URL is not set — check backend/.env or the environment');
}

process.env.DATABASE_URL = baseUrl.replace(/\/[^/]+$/, '/meowpay_test');
