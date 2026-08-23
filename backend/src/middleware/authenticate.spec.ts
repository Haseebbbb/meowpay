import type { NextFunction, Request, Response } from 'express';

import type { AuthenticatedCat } from '../models';
import { verifyAuthToken } from '../utils/jwt';
import { authenticate } from './authenticate';

jest.mock('../utils/jwt');

const verifyAuthTokenMock = verifyAuthToken as jest.MockedFunction<typeof verifyAuthToken>;

const res = {} as Response;

function makeReq(method: string, path: string, headers: Record<string, string> = {}): Request {
  return {
    method,
    path,
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

describe('authenticate — public routes', () => {
  it.each([
    ['GET', '/health'],
    ['POST', '/auth/signup'],
    ['POST', '/auth/login'],
  ])('allows %s %s through with no token', (method, path) => {
    const req = makeReq(method, path);
    const next = jest.fn() as unknown as NextFunction;

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(verifyAuthTokenMock).not.toHaveBeenCalled();
  });
});

describe('authenticate — protected routes', () => {
  it('rejects a request with no Authorization header', () => {
    const req = makeReq('GET', '/cats/me');
    const next = jest.fn() as unknown as NextFunction;

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((next as jest.Mock).mock.calls[0]?.[0]).toMatchObject({
      status: 401,
      message: 'Missing or malformed Authorization header',
    });
  });

  it('rejects a header that is not "Bearer <token>"', () => {
    const req = makeReq('GET', '/cats/me', { authorization: 'Basic abc123' });
    const next = jest.fn() as unknown as NextFunction;

    authenticate(req, res, next);

    expect((next as jest.Mock).mock.calls[0]?.[0]).toMatchObject({
      status: 401,
      message: 'Missing or malformed Authorization header',
    });
  });

  it('rejects "Bearer" with no token following it', () => {
    const req = makeReq('GET', '/cats/me', { authorization: 'Bearer' });
    const next = jest.fn() as unknown as NextFunction;

    authenticate(req, res, next);

    expect((next as jest.Mock).mock.calls[0]?.[0]).toMatchObject({ status: 401 });
  });

  it('rejects an invalid/expired token', () => {
    verifyAuthTokenMock.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    const req = makeReq('GET', '/cats/me', { authorization: 'Bearer bad.token.value' });
    const next = jest.fn() as unknown as NextFunction;

    authenticate(req, res, next);

    expect((next as jest.Mock).mock.calls[0]?.[0]).toMatchObject({
      status: 401,
      message: 'Invalid or expired token',
    });
  });

  it('attaches the decoded cat to req and calls next() with no error on a valid token', () => {
    const decoded: AuthenticatedCat = { id: 'cat-1', name: 'Felix', email: 'felix@meowpay.dev' };
    verifyAuthTokenMock.mockReturnValue(decoded);
    const req = makeReq('GET', '/cats/me', { authorization: 'Bearer good.token.value' });
    const next = jest.fn() as unknown as NextFunction;

    authenticate(req, res, next);

    expect(req.cat).toEqual(decoded);
    expect(next).toHaveBeenCalledWith();
  });
});
