import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthenticatedRequest, JwtAccessPayload } from '../types/auth';
import { sendError } from '../utils/api-response';
import { logger } from '../utils/logger';

export const authenticateJWT = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    sendError(res, 401, 'UNAUTHORIZED', 'No authentication token provided');
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtAccessPayload;
    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      sendError(res, 401, 'TOKEN_EXPIRED', 'Access token has expired');
    } else if (err instanceof jwt.JsonWebTokenError) {
      sendError(res, 401, 'TOKEN_INVALID', 'Invalid access token');
    } else {
      logger.error('JWT verification error', { error: err });
      sendError(res, 500, 'AUTH_ERROR', 'Authentication error');
    }
  }
};

export const requireRole = (role: 'admin' | 'user') =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 401, 'UNAUTHORIZED', 'Not authenticated');
      return;
    }
    if (role === 'admin' && req.user.role !== 'admin') {
      sendError(res, 403, 'FORBIDDEN', 'Insufficient permissions');
      return;
    }
    next();
  };
