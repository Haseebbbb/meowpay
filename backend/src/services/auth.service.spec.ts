import bcrypt from 'bcryptjs';

import type { Cat } from '../models';
import { catRepository } from '../repositories/cat.repository';
import { signAuthToken } from '../utils/jwt';
import { authService } from './auth.service';

jest.mock('bcryptjs');
jest.mock('../repositories/cat.repository');
jest.mock('../utils/jwt');

// Cast to a plain, ungenerified jest.Mock: bcryptjs's overloaded hash/compare
// signatures make jest.MockedFunction<typeof ...> collapse mockResolvedValue's
// parameter type to `never`.
const hashMock = bcrypt.hash as unknown as jest.Mock;
const compareMock = bcrypt.compare as unknown as jest.Mock;
const findByEmailMock = catRepository.findByEmail as jest.MockedFunction<typeof catRepository.findByEmail>;
const createMock = catRepository.create as jest.MockedFunction<typeof catRepository.create>;
const signAuthTokenMock = signAuthToken as jest.MockedFunction<typeof signAuthToken>;

function makeCat(overrides: Partial<Cat> = {}): Cat {
  return {
    id: 'cat-1',
    name: 'Whiskers',
    email: 'whiskers@meowpay.dev',
    password_hash: 'stored-hash',
    balance: 0,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('authService.signup', () => {
  it('throws a 409 conflict when the email is already registered', async () => {
    findByEmailMock.mockResolvedValue(makeCat());

    await expect(
      authService.signup({ name: 'Felix', email: 'felix@meowpay.dev', password: 'secret123' }),
    ).rejects.toMatchObject({ status: 409 });

    expect(createMock).not.toHaveBeenCalled();
  });

  it('normalizes email (trim + lowercase) before checking existence and inserting', async () => {
    findByEmailMock.mockResolvedValue(null);
    hashMock.mockResolvedValue('hashed-password');
    createMock.mockResolvedValue(makeCat({ email: 'felix@meowpay.dev' }));
    signAuthTokenMock.mockReturnValue('signed-token');

    await authService.signup({ name: 'Felix', email: '  Felix@MeowPay.dev  ', password: 'secret123' });

    expect(findByEmailMock).toHaveBeenCalledWith('felix@meowpay.dev');
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ email: 'felix@meowpay.dev' }));
  });

  it('trims the name before insert', async () => {
    findByEmailMock.mockResolvedValue(null);
    hashMock.mockResolvedValue('hashed-password');
    createMock.mockResolvedValue(makeCat());
    signAuthTokenMock.mockReturnValue('signed-token');

    await authService.signup({ name: '  Felix  ', email: 'felix@meowpay.dev', password: 'secret123' });

    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'Felix' }));
  });

  it('hashes the password before storing it — never inserts the raw password', async () => {
    findByEmailMock.mockResolvedValue(null);
    hashMock.mockResolvedValue('$2a$10$hashedvalue');
    createMock.mockResolvedValue(makeCat());
    signAuthTokenMock.mockReturnValue('signed-token');

    await authService.signup({ name: 'Felix', email: 'felix@meowpay.dev', password: 'secret123' });

    expect(hashMock).toHaveBeenCalledWith('secret123', 10);

    const insertedArg = createMock.mock.calls[0]?.[0];
    expect(insertedArg?.password_hash).toBe('$2a$10$hashedvalue');
    expect(insertedArg?.password_hash).not.toBe('secret123');
  });

  it('always inserts with balance 0', async () => {
    findByEmailMock.mockResolvedValue(null);
    hashMock.mockResolvedValue('hashed-password');
    createMock.mockResolvedValue(makeCat());
    signAuthTokenMock.mockReturnValue('signed-token');

    await authService.signup({ name: 'Felix', email: 'felix@meowpay.dev', password: 'secret123' });

    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ balance: 0 }));
  });

  it('returns { token, cat } without leaking password_hash', async () => {
    findByEmailMock.mockResolvedValue(null);
    hashMock.mockResolvedValue('hashed-password');
    createMock.mockResolvedValue(makeCat({ id: 'cat-42', name: 'Felix', email: 'felix@meowpay.dev' }));
    signAuthTokenMock.mockReturnValue('signed-token');

    const result = await authService.signup({
      name: 'Felix',
      email: 'felix@meowpay.dev',
      password: 'secret123',
    });

    expect(result).toEqual({
      token: 'signed-token',
      cat: { id: 'cat-42', name: 'Felix', email: 'felix@meowpay.dev' },
    });
    expect(result.cat).not.toHaveProperty('password_hash');
  });

  it('signs the token with exactly {id, name, email}', async () => {
    findByEmailMock.mockResolvedValue(null);
    hashMock.mockResolvedValue('hashed-password');
    createMock.mockResolvedValue(makeCat({ id: 'cat-42', name: 'Felix', email: 'felix@meowpay.dev' }));
    signAuthTokenMock.mockReturnValue('signed-token');

    await authService.signup({ name: 'Felix', email: 'felix@meowpay.dev', password: 'secret123' });

    expect(signAuthTokenMock).toHaveBeenCalledWith({
      id: 'cat-42',
      name: 'Felix',
      email: 'felix@meowpay.dev',
    });
  });
});

describe('authService.login', () => {
  it('throws a generic 401 when no cat matches the email', async () => {
    findByEmailMock.mockResolvedValue(null);

    await expect(authService.login({ email: 'nobody@meowpay.dev', password: 'secret123' })).rejects.toMatchObject({
      status: 401,
      message: 'Invalid email or password',
    });

    expect(compareMock).not.toHaveBeenCalled();
  });

  it('throws the same generic 401 when the password does not match', async () => {
    findByEmailMock.mockResolvedValue(makeCat());
    compareMock.mockResolvedValue(false);

    await expect(
      authService.login({ email: 'whiskers@meowpay.dev', password: 'wrong-password' }),
    ).rejects.toMatchObject({
      status: 401,
      message: 'Invalid email or password',
    });
  });

  it('normalizes email before lookup', async () => {
    findByEmailMock.mockResolvedValue(makeCat());
    compareMock.mockResolvedValue(true);
    signAuthTokenMock.mockReturnValue('signed-token');

    await authService.login({ email: '  Whiskers@MeowPay.dev  ', password: 'secret123' });

    expect(findByEmailMock).toHaveBeenCalledWith('whiskers@meowpay.dev');
  });

  it('returns { token, cat } on success', async () => {
    findByEmailMock.mockResolvedValue(makeCat({ id: 'cat-1', name: 'Whiskers', email: 'whiskers@meowpay.dev' }));
    compareMock.mockResolvedValue(true);
    signAuthTokenMock.mockReturnValue('signed-token');

    const result = await authService.login({ email: 'whiskers@meowpay.dev', password: 'secret123' });

    expect(result).toEqual({
      token: 'signed-token',
      cat: { id: 'cat-1', name: 'Whiskers', email: 'whiskers@meowpay.dev' },
    });
  });
});
