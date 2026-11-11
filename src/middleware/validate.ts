import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/api-response';

export const validateBody = <T>(schema: ZodSchema<T>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      sendError(res, 400, 'VALIDATION_ERROR', 'Invalid request body', result.error.flatten());
      return;
    }
    req.body = result.data;
    next();
  };

export const validateQuery = <T>(schema: ZodSchema<T>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', result.error.flatten());
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    req.query = result.data as any;
    next();
  };
