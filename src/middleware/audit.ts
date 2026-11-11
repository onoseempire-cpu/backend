import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import prisma from '../config/database';
import { logger } from '../utils/logger';

export const auditLog = (
  action: string,
  resource?: string
) => async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Run after request completes
  res.on('finish', async () => {
    const success = res.statusCode < 400;
    try {
      await prisma.auditLog.create({
        data: {
          userId: req.user?.userId ?? null,
          action,
          resource: resource ?? null,
          metadata: JSON.stringify({
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            query: req.query,
          }),
          ipAddress: (req.headers['x-forwarded-for'] as string) ?? req.ip ?? null,
          userAgent: req.headers['user-agent'] ?? null,
          success,
        },
      });
    } catch (err) {
      logger.warn('Failed to write audit log', { error: err, action });
    }
  });
  next();
};
