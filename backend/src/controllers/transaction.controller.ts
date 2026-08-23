import type { NextFunction, Request, Response } from 'express';

import { requireAuthenticatedCat } from '../middleware/authenticate';
import { HttpError } from '../middleware/http-error';
import { transactionService } from '../services/transaction.service';

function parseAmount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw HttpError.badRequest('amount must be a positive integer');
  }
  return value;
}

function parseIdempotencyKey(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw HttpError.badRequest('idempotencyKey is required');
  }
  return value;
}

function parseToCatId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw HttpError.badRequest('toCatId is required');
  }
  return value;
}

export const transactionController = {
  async topup(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { id: catId } = requireAuthenticatedCat(req);
    const body = (req.body ?? {}) as Record<string, unknown>;

    const amount = parseAmount(body['amount']);
    const idempotencyKey = parseIdempotencyKey(body['idempotencyKey']);

    const { transactionId, newBalance, replayed } = await transactionService.topup(catId, {
      amount,
      idempotencyKey,
    });

    // 201 for a freshly created transaction, 200 when this call just replayed
    // an already-processed idempotency key.
    res.status(replayed ? 200 : 201).json({ transactionId, newBalance });
  },

  async transfer(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { id: fromCatId } = requireAuthenticatedCat(req);
    const body = (req.body ?? {}) as Record<string, unknown>;

    const amount = parseAmount(body['amount']);
    const idempotencyKey = parseIdempotencyKey(body['idempotencyKey']);
    const toCatId = parseToCatId(body['toCatId']);

    const { transactionId, newBalance, replayed } = await transactionService.transfer(fromCatId, {
      toCatId,
      amount,
      idempotencyKey,
    });

    res.status(replayed ? 200 : 201).json({ transactionId, newBalance });
  },

  async list(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { id: catId } = requireAuthenticatedCat(req);

    const results = await transactionService.listForCat(catId);
    res.status(200).json(results);
  },
};
