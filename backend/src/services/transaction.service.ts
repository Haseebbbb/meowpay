import { POSTGRES_ERROR_CODE } from '../constants/postgres.constants';
import { TRANSACTION_DIRECTION, TRANSACTION_STATUS, TRANSACTION_TYPE, TRANSACTION_VIEW_DIRECTION } from '../constants/transaction.constants';
import { db } from '../config/database';
import { HttpError } from '../middleware/http-error';
import type { MoneyMovementResult, TopupInput, TransactionView, TransferInput } from '../models';
import { catRepository } from '../repositories/cat.repository';
import { transactionRepository } from '../repositories/transaction.repository';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === POSTGRES_ERROR_CODE.UNIQUE_VIOLATION
  );
}

export const transactionService = {
  async topup(catId: string, input: TopupInput): Promise<MoneyMovementResult> {
    const existing = await transactionRepository.findByIdempotencyKey(db, {
      idempotencyKey: input.idempotencyKey,
      catId,
      direction: TRANSACTION_DIRECTION.INCOMING,
    });
    if (existing && existing.type === TRANSACTION_TYPE.TOPUP) {
      const cat = await catRepository.findById(catId);
      return { transactionId: existing.id, newBalance: cat?.balance ?? 0, replayed: true };
    }

    try {
      return await db.transaction(async (trx) => {
        const row = await transactionRepository.insert(trx, {
          type: TRANSACTION_TYPE.TOPUP,
          cat_id: catId,
          direction: TRANSACTION_DIRECTION.INCOMING,
          counterparty_cat_id: null,
          amount: input.amount,
          status: TRANSACTION_STATUS.COMPLETED,
          idempotency_key: input.idempotencyKey,
        });

        await catRepository.adjustBalance(trx, catId, input.amount);
        const updated = await catRepository.findById(catId, trx);

        return { transactionId: row.id, newBalance: updated?.balance ?? 0, replayed: false };
      });
    } catch (error) {
      // A concurrent request with the same idempotency key can race past the
      // check above; the DB's unique constraint is the real guard. When that
      // fires, the other request already committed — return its result.
      if (isUniqueViolation(error)) {
        const raced = await transactionRepository.findByIdempotencyKey(db, {
          idempotencyKey: input.idempotencyKey,
          catId,
          direction: TRANSACTION_DIRECTION.INCOMING,
        });
        if (raced) {
          const cat = await catRepository.findById(catId);
          return { transactionId: raced.id, newBalance: cat?.balance ?? 0, replayed: true };
        }
      }
      throw error;
    }
  },

  async transfer(fromCatId: string, input: TransferInput): Promise<MoneyMovementResult> {
    if (input.toCatId === fromCatId) {
      throw HttpError.badRequest('cannot transfer to yourself');
    }

    const recipient = await catRepository.findById(input.toCatId);
    if (!recipient) {
      throw HttpError.badRequest('toCatId does not exist');
    }

    const existing = await transactionRepository.findByIdempotencyKey(db, {
      idempotencyKey: input.idempotencyKey,
      catId: fromCatId,
      direction: TRANSACTION_DIRECTION.OUTGOING,
    });
    if (existing && existing.type === TRANSACTION_TYPE.TRANSFER) {
      const sender = await catRepository.findById(fromCatId);
      return { transactionId: existing.id, newBalance: sender?.balance ?? 0, replayed: true };
    }

    try {
      return await db.transaction(async (trx) => {
        // Locks the sender's row for the rest of this transaction. A second,
        // concurrent transfer from the same sender blocks here until this one
        // commits or rolls back — that's what makes the balance check below safe.
        const sender = await catRepository.lockForUpdate(trx, fromCatId);
        if (!sender) {
          throw new Error('Authenticated cat no longer exists');
        }

        if (sender.balance < input.amount) {
          // No row written on rejection (see conversation) — simpler idempotency
          // semantics than a `failed` row that would itself count as "already processed".
          throw HttpError.unprocessable('insufficient_balance', 'Insufficient balance');
        }

        const outgoing = await transactionRepository.insert(trx, {
          type: TRANSACTION_TYPE.TRANSFER,
          cat_id: fromCatId,
          direction: TRANSACTION_DIRECTION.OUTGOING,
          counterparty_cat_id: input.toCatId,
          amount: input.amount,
          status: TRANSACTION_STATUS.COMPLETED,
          idempotency_key: input.idempotencyKey,
        });
        await transactionRepository.insert(trx, {
          type: TRANSACTION_TYPE.TRANSFER,
          cat_id: input.toCatId,
          direction: TRANSACTION_DIRECTION.INCOMING,
          counterparty_cat_id: fromCatId,
          amount: input.amount,
          status: TRANSACTION_STATUS.COMPLETED,
          idempotency_key: input.idempotencyKey,
        });

        await catRepository.adjustBalance(trx, fromCatId, -input.amount);
        await catRepository.adjustBalance(trx, input.toCatId, input.amount);

        const updatedSender = await catRepository.findById(fromCatId, trx);
        return { transactionId: outgoing.id, newBalance: updatedSender?.balance ?? 0, replayed: false };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await transactionRepository.findByIdempotencyKey(db, {
          idempotencyKey: input.idempotencyKey,
          catId: fromCatId,
          direction: TRANSACTION_DIRECTION.OUTGOING,
        });
        if (raced) {
          const sender = await catRepository.findById(fromCatId);
          return { transactionId: raced.id, newBalance: sender?.balance ?? 0, replayed: true };
        }
      }
      throw error;
    }
  },

  async listForCat(catId: string): Promise<TransactionView[]> {
    const rows = await transactionRepository.findAllForCat(catId);

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      direction:
        row.type === TRANSACTION_TYPE.TOPUP
          ? TRANSACTION_VIEW_DIRECTION.TOPUP
          : row.direction === TRANSACTION_DIRECTION.OUTGOING
            ? TRANSACTION_VIEW_DIRECTION.SENT
            : TRANSACTION_VIEW_DIRECTION.RECEIVED,
      amount: row.amount,
      counterpartyCatId: row.counterparty_cat_id,
      status: row.status,
      createdAt: row.created_at,
    }));
  },
};
