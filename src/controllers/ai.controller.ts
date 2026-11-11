import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { parseQuery } from '../ai/search/query-parser';
import { executeQuery } from '../ai/search/query-executor';
import { formatResponse } from '../ai/search/response-formatter';
import prisma from '../config/database';
import { sendSuccess, sendError } from '../utils/api-response';
import type { AuthenticatedRequest } from '../types/auth';

const SearchSchema = z.object({
  query: z.string().min(3, 'Query must be at least 3 characters').max(500),
});

export class AIController {
  static async search(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { query } = SearchSchema.parse(req.body);
      const startTime = Date.now();

      // Parse intent
      const parsed = parseQuery(query);

      // Validate user has at least one connected account
      const accountCount = await prisma.connectedAccount.count({
        where: { userId: req.user.userId, status: 'active' },
      });
      if (accountCount === 0) {
        sendError(res, 400, 'NO_ACCOUNTS', 'Please connect at least one account before searching');
        return;
      }

      // Execute structured query
      const result = await executeQuery(req.user.userId, parsed);

      // Format human-readable response
      const formatted = formatResponse(parsed, result);

      const responseTimeMs = Date.now() - startTime;

      // Store search history
      await prisma.searchHistory.create({
        data: {
          userId: req.user.userId,
          queryText: query,
          parsedIntent: JSON.stringify({ intent: parsed.intent, source: parsed.source, period: parsed.period }),
          resultSummary: formatted.answer.substring(0, 500),
          resultDataJson: JSON.stringify(formatted.data),
          responseTimeMs,
          hasResults: result.found,
        },
      });

      sendSuccess(res, formatted, 200, { lastSync: null });
    } catch (err) { next(err); }
  }

  static async getSearchHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const history = await prisma.searchHistory.findMany({
        where: { userId: req.user.userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true, queryText: true, resultSummary: true, hasResults: true, responseTimeMs: true, createdAt: true },
      });
      sendSuccess(res, history);
    } catch (err) { next(err); }
  }
}
