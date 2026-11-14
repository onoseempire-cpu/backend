import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { sendError } from '../utils/api-response';

export const validateBody = (schema: ZodSchema) => async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    req.body = await schema.parseAsync(req.body);
    next();
  } catch (err) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Invalid request body', err);
  }
};

export const validateQuery = (schema: ZodSchema) => async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    req.query = await schema.parseAsync(req.query);
    next();
  } catch (err) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', err);
  }
};