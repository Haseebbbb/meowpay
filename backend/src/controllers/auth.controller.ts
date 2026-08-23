import type { NextFunction, Request, Response } from 'express';

import { EMAIL_PATTERN, MIN_PASSWORD_LENGTH } from '../constants/auth.constants';
import { HttpError } from '../middleware/http-error';
import { authService } from '../services/auth.service';

export const authController = {
  async signup(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { name, email, password } = (req.body ?? {}) as Record<string, unknown>;

    if (typeof name !== 'string' || !name.trim()) {
      throw HttpError.badRequest('name is required');
    }
    if (typeof email !== 'string' || !EMAIL_PATTERN.test(email)) {
      throw HttpError.badRequest('a valid email is required');
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      throw HttpError.badRequest(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const result = await authService.signup({ name, email, password });
    res.status(201).json(result);
  },

  async login(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { email, password } = (req.body ?? {}) as Record<string, unknown>;

    if (typeof email !== 'string' || typeof password !== 'string') {
      throw HttpError.badRequest('email and password are required');
    }

    const result = await authService.login({ email, password });
    res.status(200).json(result);
  },
};
