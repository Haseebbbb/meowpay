import { POSTGRES_ERROR_CODE } from '../constants/postgres.constants';
import { TRANSACTION_DIRECTION, TRANSACTION_STATUS, TRANSACTION_TYPE, TRANSACTION_VIEW_DIRECTION } from '../constants/transaction.constants';
import { db } from '../config/database';
import type { Cat, Transaction } from '../models';
import { catRepository } from '../repositories/cat.repository';
import { transactionRepository } from '../repositories/transaction.repository';
import { transactionService } from './transaction.service';

jest.mock('../repositories/cat.repository');
jest.mock('../repositories/transaction.repository');
// `db.transaction` runs real SQL in production — replaced here with a fake
// that just invokes the callback, so we can unit-test the balance-check /
// insert / adjust logic inside it without a real Postgres connection.
jest.mock('../config/database', () => ({ db: { transaction: jest.fn() } }));

const findByIdMock = catRepository.findById as jest.MockedFunction<typeof catRepository.findById>;
const lockForUpdateMock = catRepository.lockForUpdate as jest.MockedFunction<typeof catRepository.lockForUpdate>;
const adjustBalanceMock = catRepository.adjustBalance as jest.MockedFunction<typeof catRepository.adjustBalance>;
const findByIdempotencyKeyMock = transactionRepository.findByIdempotencyKey as jest.MockedFunction<
  typeof transactionRepository.findByIdempotencyKey
>;
const insertMock = transactionRepository.insert as jest.MockedFunction<typeof transactionRepository.insert>;
const findAllForCatMock = transactionRepository.findAllForCat as jest.MockedFunction<typeof transactionRepository.findAllForCat>;
const dbTransactionMock = db.transaction as unknown as jest.Mock;

function uniqueViolation(): Error {
  return Object.assign(new Error('duplicate key value violates unique constraint'), {
    code: POSTGRES_ERROR_CODE.UNIQUE_VIOLATION,
  });
}

function makeCat(overrides: Partial<Cat> = {}): Cat {
  return {
    id: 'cat-1',
    name: 'Whiskers',
    email: 'whiskers@meowpay.dev',
    password_hash: 'stored-hash',
    balance: 100,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-default',
    type: TRANSACTION_TYPE.TOPUP,
    cat_id: 'cat-1',
    direction: TRANSACTION_DIRECTION.INCOMING,
    counterparty_cat_id: null,
    amount: 100,
    status: TRANSACTION_STATUS.COMPLETED,
    idempotency_key: 'key-default',
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  // Mirrors real Knex semantics: resolves with the callback's return value,
  // rejects if the callback throws/rejects.
  dbTransactionMock.mockImplementation((callback: (trx: unknown) => unknown) => callback({}));
});

describe('transactionService.topup', () => {
  it('returns the existing result when the idempotency key was already processed', async () => {
    findByIdempotencyKeyMock.mockResolvedValue(makeTransaction({ id: 'txn-1', type: TRANSACTION_TYPE.TOPUP }));
    findByIdMock.mockResolvedValue(makeCat({ balance: 500 }));

    const result = await transactionService.topup('cat-1', { amount: 100, idempotencyKey: 'key-1' });

    expect(result).toEqual({ transactionId: 'txn-1', newBalance: 500, replayed: true });
    expect(insertMock).not.toHaveBeenCalled();
    expect(adjustBalanceMock).not.toHaveBeenCalled();
  });

  it('inserts an incoming TOPUP row and increments balance on a fresh idempotency key', async () => {
    findByIdempotencyKeyMock.mockResolvedValue(null);
    insertMock.mockResolvedValue(makeTransaction({ id: 'txn-2' }));
    findByIdMock.mockResolvedValue(makeCat({ balance: 600 }));

    const result = await transactionService.topup('cat-1', { amount: 100, idempotencyKey: 'key-2' });

    expect(insertMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: TRANSACTION_TYPE.TOPUP,
        cat_id: 'cat-1',
        direction: TRANSACTION_DIRECTION.INCOMING,
        counterparty_cat_id: null,
        amount: 100,
        status: TRANSACTION_STATUS.COMPLETED,
        idempotency_key: 'key-2',
      }),
    );
    expect(adjustBalanceMock).toHaveBeenCalledWith(expect.anything(), 'cat-1', 100);
    expect(result).toEqual({ transactionId: 'txn-2', newBalance: 600, replayed: false });
  });

  it("returns the racing request's result when a concurrent insert wins the unique constraint", async () => {
    findByIdempotencyKeyMock.mockResolvedValueOnce(null).mockResolvedValueOnce(makeTransaction({ id: 'txn-3' }));
    dbTransactionMock.mockImplementation(async () => {
      throw uniqueViolation();
    });
    findByIdMock.mockResolvedValue(makeCat({ balance: 700 }));

    const result = await transactionService.topup('cat-1', { amount: 100, idempotencyKey: 'key-3' });

    expect(result).toEqual({ transactionId: 'txn-3', newBalance: 700, replayed: true });
  });

  it('rethrows an error that is not a unique constraint violation', async () => {
    findByIdempotencyKeyMock.mockResolvedValue(null);
    const dbError = new Error('connection lost');
    dbTransactionMock.mockImplementation(async () => {
      throw dbError;
    });

    await expect(transactionService.topup('cat-1', { amount: 100, idempotencyKey: 'key-4' })).rejects.toBe(dbError);
  });

  it("rethrows the original error if a unique-violation race can't be resolved by re-fetching", async () => {
    findByIdempotencyKeyMock.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const raceError = uniqueViolation();
    dbTransactionMock.mockImplementation(async () => {
      throw raceError;
    });

    await expect(transactionService.topup('cat-1', { amount: 100, idempotencyKey: 'key-5' })).rejects.toBe(raceError);
  });
});

describe('transactionService.transfer', () => {
  it('rejects a transfer to yourself with 400, before touching the database', async () => {
    await expect(
      transactionService.transfer('cat-1', { toCatId: 'cat-1', amount: 10, idempotencyKey: 'k' }),
    ).rejects.toMatchObject({ status: 400 });

    expect(findByIdMock).not.toHaveBeenCalled();
  });

  it('rejects with 400 when toCatId does not exist', async () => {
    findByIdMock.mockResolvedValue(null);

    await expect(
      transactionService.transfer('cat-1', { toCatId: 'ghost', amount: 10, idempotencyKey: 'k' }),
    ).rejects.toMatchObject({ status: 400 });

    expect(findByIdempotencyKeyMock).not.toHaveBeenCalled();
  });

  it('returns the existing result for an already-processed transfer idempotency key', async () => {
    findByIdMock.mockResolvedValueOnce(makeCat({ id: 'cat-2' })); // recipient exists check
    findByIdempotencyKeyMock.mockResolvedValue(
      makeTransaction({ id: 'txn-out', type: TRANSACTION_TYPE.TRANSFER, direction: TRANSACTION_DIRECTION.OUTGOING }),
    );
    findByIdMock.mockResolvedValueOnce(makeCat({ id: 'cat-1', balance: 400 })); // sender balance for the reply

    const result = await transactionService.transfer('cat-1', { toCatId: 'cat-2', amount: 50, idempotencyKey: 'k' });

    expect(result).toEqual({ transactionId: 'txn-out', newBalance: 400, replayed: true });
    expect(dbTransactionMock).not.toHaveBeenCalled();
  });

  it('rejects with 422 insufficient_balance and writes no rows when balance is too low', async () => {
    findByIdMock.mockResolvedValue(makeCat({ id: 'cat-2' })); // recipient exists check
    findByIdempotencyKeyMock.mockResolvedValue(null);
    lockForUpdateMock.mockResolvedValue(makeCat({ id: 'cat-1', balance: 10 }));

    await expect(
      transactionService.transfer('cat-1', { toCatId: 'cat-2', amount: 50, idempotencyKey: 'k' }),
    ).rejects.toMatchObject({ status: 422, code: 'insufficient_balance' });

    expect(insertMock).not.toHaveBeenCalled();
    expect(adjustBalanceMock).not.toHaveBeenCalled();
  });

  it('creates outgoing+incoming rows, adjusts both balances, and returns the sender-side transaction id', async () => {
    findByIdMock.mockResolvedValueOnce(makeCat({ id: 'cat-2' })); // recipient exists check
    findByIdempotencyKeyMock.mockResolvedValue(null);
    lockForUpdateMock.mockResolvedValue(makeCat({ id: 'cat-1', balance: 100 }));
    insertMock
      .mockResolvedValueOnce(makeTransaction({ id: 'txn-out', type: TRANSACTION_TYPE.TRANSFER, direction: TRANSACTION_DIRECTION.OUTGOING }))
      .mockResolvedValueOnce(makeTransaction({ id: 'txn-in', type: TRANSACTION_TYPE.TRANSFER, direction: TRANSACTION_DIRECTION.INCOMING }));
    findByIdMock.mockResolvedValueOnce(makeCat({ id: 'cat-1', balance: 40 })); // post-adjustment sender read

    const result = await transactionService.transfer('cat-1', { toCatId: 'cat-2', amount: 60, idempotencyKey: 'k' });

    expect(insertMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        type: TRANSACTION_TYPE.TRANSFER,
        cat_id: 'cat-1',
        direction: TRANSACTION_DIRECTION.OUTGOING,
        counterparty_cat_id: 'cat-2',
        amount: 60,
      }),
    );
    expect(insertMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        type: TRANSACTION_TYPE.TRANSFER,
        cat_id: 'cat-2',
        direction: TRANSACTION_DIRECTION.INCOMING,
        counterparty_cat_id: 'cat-1',
        amount: 60,
      }),
    );
    expect(adjustBalanceMock).toHaveBeenCalledWith(expect.anything(), 'cat-1', -60);
    expect(adjustBalanceMock).toHaveBeenCalledWith(expect.anything(), 'cat-2', 60);
    expect(result).toEqual({ transactionId: 'txn-out', newBalance: 40, replayed: false });
  });

  it("returns the racing request's result when concurrent transfers collide on the idempotency key", async () => {
    findByIdMock.mockResolvedValueOnce(makeCat({ id: 'cat-2' })); // recipient exists check
    findByIdempotencyKeyMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeTransaction({ id: 'txn-out', type: TRANSACTION_TYPE.TRANSFER, direction: TRANSACTION_DIRECTION.OUTGOING }));
    dbTransactionMock.mockImplementation(async () => {
      throw uniqueViolation();
    });
    findByIdMock.mockResolvedValueOnce(makeCat({ id: 'cat-1', balance: 40 }));

    const result = await transactionService.transfer('cat-1', { toCatId: 'cat-2', amount: 60, idempotencyKey: 'k' });

    expect(result).toEqual({ transactionId: 'txn-out', newBalance: 40, replayed: true });
  });
});

describe('transactionService.listForCat', () => {
  it('maps type+direction to sent/received/topup and converts field names', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    findAllForCatMock.mockResolvedValue([
      makeTransaction({
        id: 't1',
        type: TRANSACTION_TYPE.TOPUP,
        direction: TRANSACTION_DIRECTION.INCOMING,
        counterparty_cat_id: null,
        amount: 100,
        created_at: createdAt,
      }),
      makeTransaction({
        id: 't2',
        type: TRANSACTION_TYPE.TRANSFER,
        direction: TRANSACTION_DIRECTION.OUTGOING,
        counterparty_cat_id: 'cat-2',
        amount: 30,
        created_at: createdAt,
      }),
      makeTransaction({
        id: 't3',
        type: TRANSACTION_TYPE.TRANSFER,
        direction: TRANSACTION_DIRECTION.INCOMING,
        counterparty_cat_id: 'cat-2',
        amount: 20,
        created_at: createdAt,
      }),
    ]);

    const result = await transactionService.listForCat('cat-1');

    expect(result).toEqual([
      {
        id: 't1',
        type: TRANSACTION_TYPE.TOPUP,
        direction: TRANSACTION_VIEW_DIRECTION.TOPUP,
        amount: 100,
        counterpartyCatId: null,
        status: TRANSACTION_STATUS.COMPLETED,
        createdAt,
      },
      {
        id: 't2',
        type: TRANSACTION_TYPE.TRANSFER,
        direction: TRANSACTION_VIEW_DIRECTION.SENT,
        amount: 30,
        counterpartyCatId: 'cat-2',
        status: TRANSACTION_STATUS.COMPLETED,
        createdAt,
      },
      {
        id: 't3',
        type: TRANSACTION_TYPE.TRANSFER,
        direction: TRANSACTION_VIEW_DIRECTION.RECEIVED,
        amount: 20,
        counterpartyCatId: 'cat-2',
        status: TRANSACTION_STATUS.COMPLETED,
        createdAt,
      },
    ]);
  });
});
