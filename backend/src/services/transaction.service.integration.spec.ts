import crypto from 'node:crypto';

import { closeDatabase, db } from '../config/database';
import type { Cat } from '../models';
import { catRepository } from '../repositories/cat.repository';
import { transactionService } from './transaction.service';

// These two tests need a real Postgres transaction to mean anything — a
// mocked repository can't demonstrate that FOR UPDATE row locking actually
// serializes concurrent transfers. Run via `npm run test:integration`
// (requires `docker compose up -d db`), never as part of plain `npm test`.

async function createTestCat(balance: number): Promise<Cat> {
  return catRepository.create({
    name: 'Integration Test Cat',
    email: `test-${crypto.randomUUID()}@meowpay.test`,
    password_hash: 'not-a-real-hash',
    balance,
  });
}

async function deleteTestCat(catId: string): Promise<void> {
  await db('transactions').where({ cat_id: catId }).orWhere({ counterparty_cat_id: catId }).del();
  await db('cats').where({ id: catId }).del();
}

afterAll(async () => {
  await closeDatabase();
});

describe('transactionService.transfer — concurrency', () => {
  it('allows exactly one of two simultaneous transfers that together exceed the balance', async () => {
    const sender = await createTestCat(100);
    const recipient = await createTestCat(0);

    try {
      const attempt = (idempotencyKey: string) =>
        transactionService
          .transfer(sender.id, { toCatId: recipient.id, amount: 60, idempotencyKey })
          .then((result) => ({ ok: true as const, result }))
          .catch((error: unknown) => ({ ok: false as const, error }));

      const [first, second] = await Promise.all([attempt(crypto.randomUUID()), attempt(crypto.randomUUID())]);
      const outcomes = [first, second];

      const succeeded = outcomes.filter((outcome) => outcome.ok);
      const failed = outcomes.filter((outcome): outcome is { ok: false; error: unknown } => !outcome.ok);

      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);
      expect(failed[0]?.error).toMatchObject({ status: 422, code: 'insufficient_balance' });

      const finalSender = await catRepository.findById(sender.id);
      const finalRecipient = await catRepository.findById(recipient.id);

      expect(finalSender?.balance).toBe(40); // 100 - 60, the other attempt never touched the balance
      expect(finalRecipient?.balance).toBe(60);
    } finally {
      await deleteTestCat(recipient.id);
      await deleteTestCat(sender.id);
    }
  });
});

describe('transactionService.transfer — idempotency', () => {
  it('returns the same transactionId and only moves the balance once on a repeated request', async () => {
    const sender = await createTestCat(100);
    const recipient = await createTestCat(0);
    const idempotencyKey = crypto.randomUUID();

    try {
      const first = await transactionService.transfer(sender.id, {
        toCatId: recipient.id,
        amount: 30,
        idempotencyKey,
      });
      const second = await transactionService.transfer(sender.id, {
        toCatId: recipient.id,
        amount: 30,
        idempotencyKey,
      });

      expect(second.transactionId).toBe(first.transactionId);
      expect(second.replayed).toBe(true);
      expect(first.replayed).toBe(false);

      const finalSender = await catRepository.findById(sender.id);
      const finalRecipient = await catRepository.findById(recipient.id);

      expect(finalSender?.balance).toBe(70); // 100 - 30, only once despite two calls
      expect(finalRecipient?.balance).toBe(30);
    } finally {
      await deleteTestCat(recipient.id);
      await deleteTestCat(sender.id);
    }
  });
});
