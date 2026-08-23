import type { NextFunction, Request, Response } from 'express';

import type { AuthResult } from '../models';
import { authService } from '../services/auth.service';
import { authController } from './auth.controller';

jest.mock('../services/auth.service');

const signupMock = authService.signup as jest.MockedFunction<typeof authService.signup>;
const loginMock = authService.login as jest.MockedFunction<typeof authService.login>;

const next = jest.fn() as unknown as NextFunction;

function makeReq(body: unknown): Request {
  return { body } as unknown as Request;
}

function makeRes(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res) as unknown as Response['status'];
  res.json = jest.fn().mockReturnValue(res) as unknown as Response['json'];
  return res;
}

const AUTH_RESULT: AuthResult = {
  token: 'signed-token',
  cat: { id: 'cat-1', name: 'Felix', email: 'felix@meowpay.dev' },
};

describe('authController.signup', () => {
  it('rejects a missing/blank name with 400', async () => {
    const req = makeReq({ email: 'felix@meowpay.dev', password: 'secret123' });
    const res = makeRes();

    await expect(authController.signup(req, res, next)).rejects.toMatchObject({ status: 400 });
    expect(signupMock).not.toHaveBeenCalled();
  });

  it('rejects a malformed email with 400', async () => {
    const req = makeReq({ name: 'Felix', email: 'not-an-email', password: 'secret123' });
    const res = makeRes();

    await expect(authController.signup(req, res, next)).rejects.toMatchObject({ status: 400 });
    expect(signupMock).not.toHaveBeenCalled();
  });

  it('rejects a password under the minimum length with 400', async () => {
    const req = makeReq({ name: 'Felix', email: 'felix@meowpay.dev', password: '123' });
    const res = makeRes();

    await expect(authController.signup(req, res, next)).rejects.toMatchObject({ status: 400 });
    expect(signupMock).not.toHaveBeenCalled();
  });

  it('calls authService.signup and responds 201 with the result on a valid body', async () => {
    const req = makeReq({ name: 'Felix', email: 'felix@meowpay.dev', password: 'secret123' });
    const res = makeRes();
    signupMock.mockResolvedValue(AUTH_RESULT);

    await authController.signup(req, res, next);

    expect(signupMock).toHaveBeenCalledWith({
      name: 'Felix',
      email: 'felix@meowpay.dev',
      password: 'secret123',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(AUTH_RESULT);
  });
});

describe('authController.login', () => {
  it('rejects a missing email/password with 400', async () => {
    const req = makeReq({ email: 'felix@meowpay.dev' });
    const res = makeRes();

    await expect(authController.login(req, res, next)).rejects.toMatchObject({ status: 400 });
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('calls authService.login and responds 200 with the result on a valid body', async () => {
    const req = makeReq({ email: 'felix@meowpay.dev', password: 'secret123' });
    const res = makeRes();
    loginMock.mockResolvedValue(AUTH_RESULT);

    await authController.login(req, res, next);

    expect(loginMock).toHaveBeenCalledWith({ email: 'felix@meowpay.dev', password: 'secret123' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(AUTH_RESULT);
  });
});
