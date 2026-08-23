/**
 * Error carrying an intended HTTP status. Services throw these for expected
 * failures (not found, validation, conflict); anything else reaching the error
 * handler is treated as a 500.
 */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    Error.captureStackTrace?.(this, HttpError);
  }

  static badRequest(message = 'Bad Request'): HttpError {
    return new HttpError(400, message);
  }

  static unauthorized(message = 'Unauthorized'): HttpError {
    return new HttpError(401, message);
  }

  static notFound(message = 'Not Found'): HttpError {
    return new HttpError(404, message);
  }

  static conflict(message = 'Conflict'): HttpError {
    return new HttpError(409, message);
  }
}
