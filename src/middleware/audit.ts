import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import prisma from '../config/database';
import { logger } from '../utils/logger';

export const auditLog = (
  action: string,
  resource?: string
) => async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  // Run after request completes
  _res.on('finish', async () => {
    const success = _res.statusCode < 400;
    try {
      await prisma.auditLog.create({
        data: {
          userId: req.user?.id ?? null,
          action,
          resource: resource ?? null,
          metadata: JSON.stringify({
            method: req.method,
            path: req.path,
            statusCode: _res.statusCode,
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