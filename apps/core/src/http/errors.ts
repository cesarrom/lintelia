/** Errors carrying an HTTP status; `jsonError` (http/respond.ts) and the Restate dispatcher honour `status`. */
export class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'HttpError';
  }
}
export class BadRequestError extends HttpError { constructor(message: string) { super(message, 400); } }
export class ForbiddenError extends HttpError { constructor(message = 'Forbidden') { super(message, 403); } }
export class NotFoundError extends HttpError { constructor(message = 'Not found') { super(message, 404); } }
export class ConflictError extends HttpError { constructor(message: string) { super(message, 409); } }
export class UnprocessableError extends HttpError {
  constructor(message: string, readonly errors: unknown[] = []) { super(message, 422); }
}
export class TooManyRequestsError extends HttpError { constructor(message = 'Too many requests') { super(message, 429); } }
