import type { NextFunction, Request, Response } from 'express';

import { transactionService } from '../services/transaction.service';
import { transactionController } from './transaction.controller';

jest.mock('../services/transaction.service');

const topupMock = transactionService.topup as jest.MockedFunction<typeof transactionService.topup>;
const transferMock = transactionService.transfer as jest.MockedFunction<typeof transactionService.transfer>;
const listForCatMock = transactionService.listForCat as jest.MockedFunction<typeof transactionService.listForCat>;

const next = jest.fn() as unknown as NextFunction;
const REQUESTER = { id: 'cat-1', name: 'Whiskers', email: 'whiskers@meowpay.dev' };

function makeReq(body: unknown): Request {
  return { body, cat: REQUESTER } as unknown as Request;
}

function makeRes(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res) as unknown as Response['status'];
  res.json = jest.fn().mockReturnValue(res) as unknown as Response['json'];
  return res;
}

const invalidTopupBodies: Array<[Record<string, unknown>, string]> = [
  [{}, 'missing amount and idempotencyKey'],
  [{ amount: 0, idempotencyKey: 'k' }, 'zero amount'],
  [{ amount: -5, idempotencyKey: 'k' }, 'negative amount'],
  [{ amount: 10.5, idempotencyKey: 'k' }, 'non-integer amount'],
  [{ amount: 10 }, 'missing idempotencyKey'],
  [{ amount: 10, idempotencyKey: '   ' }, 'blank idempotencyKey'],
];

describe('transactionController.topup', () => {
  it.each(invalidTopupBodies)('rejects %j (%s) with 400', async (body) => {
    const req = makeReq(body);
    const res = makeRes();

    await expect(transactionController.topup(req, res, next)).rejects.toMatchObject({ status: 400 });
    expect(topupMock).not.toHaveBeenCalled();
  });

  it('calls transactionService.topup with the requester id, responds 201 for a fresh transaction', async () => {
    const req = makeReq({ amount: 100, idempotencyKey: 'key-1' });
    const res = makeRes();
    topupMock.mockResolvedValue({ transactionId: 'txn-1', newBalance: 100, replayed: false });

    await transactionController.topup(req, res, next);

    expect(topupMock).toHaveBeenCalledWith('cat-1', { amount: 100, idempotencyKey: 'key-1' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ transactionId: 'txn-1', newBalance: 100 });
  });

  it('responds 200 (not 201), and does not leak `replayed`, when the service reports a replay', async () => {
    const req = makeReq({ amount: 100, idempotencyKey: 'key-1' });
    const res = makeRes();
    topupMock.mockResolvedValue({ transactionId: 'txn-1', newBalance: 100, replayed: true });

    await transactionController.topup(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ transactionId: 'txn-1', newBalance: 100 });
  });
});

const invalidTransferBodies: Array<[Record<string, unknown>, string]> = [
  [{ toCatId: 'cat-2' }, 'missing amount and idempotencyKey'],
  [{ toCatId: 'cat-2', amount: 0, idempotencyKey: 'k' }, 'zero amount'],
  [{ amount: 10, idempotencyKey: 'k' }, 'missing toCatId'],
  [{ toCatId: '   ', amount: 10, idempotencyKey: 'k' }, 'blank toCatId'],
  [{ toCatId: 'cat-2', amount: 10 }, 'missing idempotencyKey'],
];

describe('transactionController.transfer', () => {
  it.each(invalidTransferBodies)('rejects %j (%s) with 400', async (body) => {
    const req = makeReq(body);
    const res = makeRes();

    await expect(transactionController.transfer(req, res, next)).rejects.toMatchObject({ status: 400 });
    expect(transferMock).not.toHaveBeenCalled();
  });

  it('calls transactionService.transfer with the sender id, responds 201 for a fresh transfer', async () => {
    const req = makeReq({ toCatId: 'cat-2', amount: 50, idempotencyKey: 'key-1' });
    const res = makeRes();
    transferMock.mockResolvedValue({ transactionId: 'txn-1', newBalance: 50, replayed: false });

    await transactionController.transfer(req, res, next);

    expect(transferMock).toHaveBeenCalledWith('cat-1', { toCatId: 'cat-2', amount: 50, idempotencyKey: 'key-1' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ transactionId: 'txn-1', newBalance: 50 });
  });

  it('responds 200 (not 201) when the service reports a replay', async () => {
    const req = makeReq({ toCatId: 'cat-2', amount: 50, idempotencyKey: 'key-1' });
    const res = makeRes();
    transferMock.mockResolvedValue({ transactionId: 'txn-1', newBalance: 50, replayed: true });

    await transactionController.transfer(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('transactionController.list', () => {
  it('calls transactionService.listForCat with the requester id and responds 200', async () => {
    const req = makeReq(undefined);
    const res = makeRes();
    const results = [
      {
        id: 't1',
        type: 'TOPUP' as const,
        direction: 'topup' as const,
        amount: 100,
        counterpartyCatId: null,
        status: 'completed' as const,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    ];
    listForCatMock.mockResolvedValue(results);

    await transactionController.list(req, res, next);

    expect(listForCatMock).toHaveBeenCalledWith('cat-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(results);
  });
});
