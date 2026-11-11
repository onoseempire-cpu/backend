import { Response, NextFunction } from 'express';
import { IndexerService } from '../indexer/indexer.service';
import { sendSuccess } from '../utils/api-response';
import type { AuthenticatedRequest } from '../types/auth';

export class IndexerController {
  static async start(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { jobType = 'manual', sources } = req.body as { jobType?: string; sources?: string[] };
      const jobId = await IndexerService.startIndexing(
        req.user.userId,
        jobType as Parameters<typeof IndexerService.startIndexing>[1],
        sources
      );
      sendSuccess(res, { jobId, message: 'Indexing started' }, 202);
    } catch (err) { next(err); }
  }

  static async status(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const jobId = req.query.jobId as string | undefined;
      const status = await IndexerService.getStatus(req.user.userId, jobId);
      sendSuccess(res, status);
    } catch (err) { next(err); }
  }

  static async history(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const history = await IndexerService.getHistory(req.user.userId, limit);
      sendSuccess(res, history);
    } catch (err) { next(err); }
  }
}
