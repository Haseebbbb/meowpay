import type { NextFunction, Request, Response } from 'express';

import { catService } from '../services/cat.service';
import { catController } from './cat.controller';

jest.mock('../services/cat.service');

const searchMock = catService.search as jest.MockedFunction<typeof catService.search>;
const getMeMock = catService.getMe as jest.MockedFunction<typeof catService.getMe>;

const next = jest.fn() as unknown as NextFunction;
const REQUESTER = { id: 'cat-1', name: 'Whiskers', email: 'whiskers@meowpay.dev' };

function makeReq(query: Record<string, unknown> = {}): Request {
  return { query, cat: REQUESTER } as unknown as Request;
}

function makeUnauthenticatedReq(query: Record<string, unknown> = {}): Request {
  return { query } as unknown as Request; // no `cat` — simulates the auth invariant being violated
}

function makeRes(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res) as unknown as Response['status'];
  res.json = jest.fn().mockReturnValue(res) as unknown as Response['json'];
  return res;
}

describe('catController.search', () => {
  it('passes the query string and requester id to the service, responds 200', async () => {
    const req = makeReq({ q: 'sim' });
    const res = makeRes();
    const results = [{ id: 'cat-2', name: 'Simba', email: 'simba@meowpay.test' }];
    searchMock.mockResolvedValue(results);

    await catController.search(req, res, next);

    expect(searchMock).toHaveBeenCalledWith('sim', 'cat-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(results);
  });

  it('treats a missing q as an empty string rather than throwing', async () => {
    const req = makeReq({});
    const res = makeRes();
    searchMock.mockResolvedValue([]);

    await catController.search(req, res, next);

    expect(searchMock).toHaveBeenCalledWith('', 'cat-1');
  });

  it('throws 401 when req.cat is missing', async () => {
    const req = makeUnauthenticatedReq();
    const res = makeRes();

    await expect(catController.search(req, res, next)).rejects.toMatchObject({ status: 401 });
    expect(searchMock).not.toHaveBeenCalled();
  });
});

describe('catController.me', () => {
  it('calls catService.getMe with the requester id and responds 200', async () => {
    const req = makeReq();
    const res = makeRes();
    const result = { id: 'cat-1', name: 'Whiskers', email: 'whiskers@meowpay.dev', balance: 500 };
    getMeMock.mockResolvedValue(result);

    await catController.me(req, res, next);

    expect(getMeMock).toHaveBeenCalledWith('cat-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  it('throws 401 when req.cat is missing', async () => {
    const req = makeUnauthenticatedReq();
    const res = makeRes();

    await expect(catController.me(req, res, next)).rejects.toMatchObject({ status: 401 });
    expect(getMeMock).not.toHaveBeenCalled();
  });
});
