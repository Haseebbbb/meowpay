// Jest `setupFiles` entry: runs inside each test worker before any test file
// (and therefore before `src/config/env.ts`'s own dotenv.config() call) so
// DATABASE_URL etc. are already set to the test DB when app code loads.
// dotenv doesn't override an already-set process.env var, so this must run first.
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.test') });
