import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../database/prisma';
import { unauthorizedResponse } from '../utils/response';
import config from '../config/app.config';

export interface AuthenticatedRequest extends Request {
  body: any;
  query: any;
  params: any;
  headers: any;
  user?: {
    id: string;
    userId: string;
    email: string;
    name?: string;
    role?: string;
  };
}

interface JwtPayload {
  userId: string;
  type: 'access' | 'refresh';
  sessionId?: string;
}

/**
 * Middleware to authenticate JWT access token
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: { code: 'NO_TOKEN', message: 'No token provided' } });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret) as {
      userId: string;
      type: 'access' | 'refresh';
      sessionId?: string;
    };

    if (decoded.type !== 'access') {
      res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN_TYPE', message: 'Invalid token type' } });
      return;
    }

    const session = await prisma.session.findFirst({
      where: {
        id: decoded.sessionId,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) {
      res.status(401).json({ success: false, error: { code: 'SESSION_EXPIRED', message: 'Session expired or invalid' } });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found or inactive' } });
      return;
    }

    req.user = {
      id: user.id,
      userId: user.id,
      email: user.email,
      name: user.displayName ?? undefined,
      role: user.role ?? 'user',
    };

    next();
  } catch (error) {
    res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid token' } });
  }
};

/**
 * Alias for authenticate - used in route definitions
 */
export const authenticateJWT = authenticate;

/**
 * Middleware to optionally authenticate (for public endpoints)
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret) as {
      userId: string;
      type: 'access' | 'refresh';
      sessionId?: string;
    };

    if (decoded.type === 'access') {
      const session = await prisma.session.findFirst({
        where: {
          id: decoded.sessionId,
          isActive: true,
          expiresAt: { gt: new Date() },
        },
      });

      if (session) {
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
        });

        if (user && user.isActive) {
          req.user = {
            id: user.id,
            userId: user.id,
            email: user.email,
            name: user.displayName ?? undefined,
            role: user.role ?? 'user',
          };
        }
      }
    }
  } catch (error) {
    // Invalid token, but continue without user
  }

  next();
};
