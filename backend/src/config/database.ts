import knex, { type Knex } from 'knex';

import knexConfig from './knex.config';

// A single shared connection pool for the whole process. Repositories import this
// instance; they never construct their own.
export const db: Knex = knex(knexConfig);

// Repository methods that must work both standalone and inside a multi-step
// db.transaction() callback accept this instead of hardcoding `db` — callers
// pass either the shared pool or an open Knex.Transaction.
export type Executor = Knex | Knex.Transaction;

export async function closeDatabase(): Promise<void> {
  await db.destroy();
}
