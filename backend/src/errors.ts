import { ErrorRequestHandler, Request, RequestHandler, Response } from 'express';

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

// Treasury data is needed for a curve or a quote and no cached copy exists.
export class CurveUnavailableError extends HttpError {
  constructor() {
    super(502, 'failed to fetch treasury data');
  }
}

// Express 4 does not catch rejected promises from async handlers. Without
// this wrapper a thrown error becomes an unhandled rejection and Node exits.
export function asyncHandler(
  handler: (req: Request, res: Response) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

// body-parser errors (malformed JSON, oversized body) carry a 4xx status.
function isClientError(err: unknown): boolean {
  const { status, expose } = err as { status?: unknown; expose?: unknown };
  return typeof status === 'number' && status >= 400 && status < 500 && expose === true;
}

export const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (isClientError(err)) {
    res.status(400).json({ error: 'invalid request body' });
    return;
  }
  console.error('request failed', err);
  res.status(500).json({ error: 'internal error' });
};
