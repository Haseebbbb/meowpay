import type { Knex } from 'knex';

import { db, type Executor } from '../config/database';
import type { Cat, CatSummary, NewCat } from '../models';

export const catRepository = {
  async findByEmail(email: string): Promise<Cat | null> {
    const cat = await db<Cat>('cats').where({ email }).first();
    return cat ?? null;
  },

  async findById(catId: string, executor: Executor = db): Promise<Cat | null> {
    const cat = await executor<Cat>('cats').where({ id: catId }).first();
    return cat ?? null;
  },

  /**
   * Reads and row-locks the cat within an open transaction — must only be
   * called with a `Knex.Transaction`, never the shared pool, or FOR UPDATE
   * has no transaction to hold the lock for.
   */
  async lockForUpdate(trx: Knex.Transaction, catId: string): Promise<Cat | null> {
    const cat = await trx<Cat>('cats').where({ id: catId }).forUpdate().first();
    return cat ?? null;
  },

  async search(query: string, excludeCatId: string, limit: number): Promise<CatSummary[]> {
    const pattern = `%${query}%`;

    return db<CatSummary>('cats')
      .select('id', 'name', 'email')
      .where('id', '!=', excludeCatId)
      .andWhere((builder) => {
        builder.whereRaw('name ILIKE ?', [pattern]).orWhereRaw('email ILIKE ?', [pattern]);
      })
      .orderBy('name')
      .limit(limit);
  },

  async create(data: NewCat): Promise<Cat> {
    const [cat] = await db<Cat>('cats').insert(data).returning('*');

    if (!cat) {
      throw new Error('Insert into cats returned no row');
    }

    return cat;
  },

  /** delta may be negative — this is the only place balance is mutated. */
  async adjustBalance(executor: Executor, catId: string, delta: number): Promise<void> {
    await executor<Cat>('cats').where({ id: catId }).increment('balance', delta);
  },
};
