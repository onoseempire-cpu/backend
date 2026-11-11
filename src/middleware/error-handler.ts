import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { sendError } from '../utils/api-response';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Known application errors
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Invalid request data', err.flatten());
    return;
  }

  // Prisma errors
  if ('code' in err && typeof (err as Record<string,unknown>).code === 'string') {
    const prismaError = err as Error & { code: string };
    if (prismaError.code === 'P2002') {
      sendError(res, 409, 'DUPLICATE_RECORD', 'A record with this information already exists');
      return;
    }
    if (prismaError.code === 'P2025') {
      sendError(res, 404, 'NOT_FOUND', 'Record not found');
      return;
    }
  }

  // Unknown errors
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  sendError(
    res,
    500,
    'INTERNAL_ERROR',
    'An internal server error occurred',
    process.env.NODE_ENV === 'development' ? err.stack : undefined
  );
};

export const notFoundHandler = (req: Request, res: Response): void => {
  sendError(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`);
};
