import knex, { type Knex } from 'knex';

import knexConfig from './knex.config';

// A single shared connection pool for the whole process. Repositories import this
// instance; they never construct their own.
export const db: Knex = knex(knexConfig);

export async function closeDatabase(): Promise<void> {
  await db.destroy();
}
