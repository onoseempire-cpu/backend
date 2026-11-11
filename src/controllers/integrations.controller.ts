import { Response, NextFunction } from 'express';
import { generateAuthUrl, handleOAuthCallback, disconnectAccount, IntegrationProvider } from '../integrations/google/oauth';
import prisma from '../config/database';
import { sendSuccess, sendError } from '../utils/api-response';
import type { AuthenticatedRequest } from '../types/auth';

export class IntegrationsController {
  static async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const accounts = await prisma.connectedAccount.findMany({
        where: { userId: req.user.userId },
        select: { id: true, provider: true, providerAccountId: true, displayName: true, email: true, profileImageUrl: true, status: true, lastSyncAt: true, errorMessage: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
      sendSuccess(res, accounts);
    } catch (err) { next(err); }
  }

  static async getStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const counts = await prisma.connectedAccount.groupBy({
        by: ['provider', 'status'],
        where: { userId: req.user.userId },
        _count: true,
      });
      const statusMap: Record<string, { connected: boolean; accountCount: number }> = {};
      for (const row of counts) {
        if (!statusMap[row.provider]) statusMap[row.provider] = { connected: false, accountCount: 0 };
        if (row.status === 'active') {
          statusMap[row.provider].connected = true;
          statusMap[row.provider].accountCount += row._count;
        }
      }
      sendSuccess(res, statusMap);
    } catch (err) { next(err); }
  }

  static getConnectUrl(provider: IntegrationProvider) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const url = generateAuthUrl(req.user.userId, provider);
        sendSuccess(res, { authUrl: url, provider });
      } catch (err) { next(err); }
    };
  }

  static handleCallback(provider: IntegrationProvider) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const getStr = (v: unknown): string | undefined => {
          if (typeof v === 'string') return v;
          if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
          return undefined;
        };
        const code = getStr(req.query.code);
        const state = getStr(req.query.state);
        const error = getStr(req.query.error);
        if (error) { sendError(res, 400, 'OAUTH_DENIED', `OAuth denied: ${error}`); return; }
        if (!code || !state) { sendError(res, 400, 'MISSING_PARAMS', 'Missing code or state'); return; }
        const result = await handleOAuthCallback(code, state);
        sendSuccess(res, { ...result, provider, message: `${provider} connected successfully` });
      } catch (err) { next(err); }
    };
  }

  static async disconnect(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const accountId = req.params.accountId as string;
      await disconnectAccount(req.user.userId, accountId);
      sendSuccess(res, { message: 'Account disconnected successfully' });
    } catch (err) { next(err); }
  }
}
