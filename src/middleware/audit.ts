import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
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
      const expressReq = req as unknown as Request;
      await prisma.auditLog.create({
        data: {
          userId: req.user?.id ?? null,
          action,
          resource: resource ?? null,
          metadata: JSON.stringify({
            method: expressReq.method || req.method || 'GET',
            path: expressReq.path || req.path || expressReq.url || '',
            statusCode: _res.statusCode,
            query: expressReq.query || req.query,
          }),
          ipAddress: (expressReq.headers?.['x-forwarded-for'] as string) ?? expressReq.ip ?? req.ip ?? null,
          userAgent: expressReq.headers?.['user-agent'] ?? req.headers?.['user-agent'] ?? null,
          success,
        },
      });
    } catch (err) {
      logger.warn('Failed to write audit log', { error: err, action });
    }
  });
  next();
};