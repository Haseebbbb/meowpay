import bcrypt from 'bcryptjs';

import { HttpError } from '../middleware/http-error';
import type { AuthenticatedCat, AuthResult, Cat, LoginInput, SignupInput } from '../models';
import { catRepository } from '../repositories/cat.repository';
import { signAuthToken } from '../utils/jwt';

const SALT_ROUNDS = 10;
const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

function normalizeEmail(email: string): string {
  // Postgres unique constraints are case-sensitive by default; without this,
  // "Foo@x.com" and "foo@x.com" would register as two accounts and the
  // second could never log back in under the casing it signed up with.
  return email.trim().toLowerCase();
}

function toAuthenticatedCat(cat: Pick<Cat, 'id' | 'name' | 'email'>): AuthenticatedCat {
  return { id: cat.id, name: cat.name, email: cat.email };
}

export const authService = {
  async signup(input: SignupInput): Promise<AuthResult> {
    const email = normalizeEmail(input.email);
    const name = input.name.trim();

    const existing = await catRepository.findByEmail(email);
    if (existing) {
      throw HttpError.conflict('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const cat = await catRepository.create({
      name,
      email,
      password_hash: passwordHash,
      balance: 0,
    });

    const authenticatedCat = toAuthenticatedCat(cat);
    return { token: signAuthToken(authenticatedCat), cat: authenticatedCat };
  },

  async login(input: LoginInput): Promise<AuthResult> {
    const email = normalizeEmail(input.email);

    const cat = await catRepository.findByEmail(email);
    if (!cat) {
      throw HttpError.unauthorized(INVALID_CREDENTIALS_MESSAGE);
    }

    const passwordMatches = await bcrypt.compare(input.password, cat.password_hash);
    if (!passwordMatches) {
      throw HttpError.unauthorized(INVALID_CREDENTIALS_MESSAGE);
    }

    const authenticatedCat = toAuthenticatedCat(cat);
    return { token: signAuthToken(authenticatedCat), cat: authenticatedCat };
  },
};
