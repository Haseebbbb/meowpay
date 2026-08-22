// Entry point for the knex CLI (`npm run migrate`). The real configuration lives in
// src/config/knex.config.ts so the application and the CLI share one source of truth.
//
// This file is intentionally outside `src/` and therefore excluded from `tsc` output;
// production migrations run against the compiled config instead:
//   knex --knexfile dist/config/knex.config.js migrate:latest
import knexConfig from './src/config/knex.config';

export default knexConfig;
