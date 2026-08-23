import { db, type Executor } from '../config/database';
import type { NewTransaction, Transaction, TransactionDirection } from '../models';

export const transactionRepository = {
  async findByIdempotencyKey(
    executor: Executor,
    params: { idempotencyKey: string; catId: string; direction: TransactionDirection },
  ): Promise<Transaction | null> {
    const row = await executor<Transaction>('transactions')
      .where({
        idempotency_key: params.idempotencyKey,
        cat_id: params.catId,
        direction: params.direction,
      })
      .first();

    return row ?? null;
  },

  async insert(executor: Executor, data: NewTransaction): Promise<Transaction> {
    const [row] = await executor<Transaction>('transactions').insert(data).returning('*');

    if (!row) {
      throw new Error('Insert into transactions returned no row');
    }

    return row;
  },

  async findAllForCat(catId: string): Promise<Transaction[]> {
    // Every row already belongs to exactly one cat (the ledger design), so
    // this alone covers both sent and received — no OR-across-two-columns needed.
    return db<Transaction>('transactions').where({ cat_id: catId }).orderBy('created_at', 'desc');
  },
};
