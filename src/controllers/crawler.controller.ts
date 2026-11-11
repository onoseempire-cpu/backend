import { Response, NextFunction } from 'express';
import { CrawlerService } from '../crawler/crawler.service';
import { sendSuccess, sendError } from '../utils/api-response';
import type { AuthenticatedRequest } from '../types/auth';

export class CrawlerController {
  static async start(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { jobType = 'sync', sources } = req.body as { jobType?: string; sources?: string[] };
      const jobId = await CrawlerService.startCrawl(req.user.userId, jobType as Parameters<typeof CrawlerService.startCrawl>[1], sources);
      sendSuccess(res, { jobId, message: 'Crawler started' }, 202);
    } catch (err) { next(err); }
  }

  static async pause(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { jobId } = req.body as { jobId: string };
      if (!jobId) { sendError(res, 400, 'MISSING_PARAM', 'jobId required'); return; }
      await CrawlerService.pause(req.user.userId, jobId);
      sendSuccess(res, { message: 'Crawler paused' });
    } catch (err) { next(err); }
  }

  static async resume(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { jobId } = req.body as { jobId: string };
      if (!jobId) { sendError(res, 400, 'MISSING_PARAM', 'jobId required'); return; }
      await CrawlerService.resume(req.user.userId, jobId);
      sendSuccess(res, { message: 'Crawler resumed' });
    } catch (err) { next(err); }
  }

  static async stop(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { jobId } = req.body as { jobId: string };
      if (!jobId) { sendError(res, 400, 'MISSING_PARAM', 'jobId required'); return; }
      await CrawlerService.stop(req.user.userId, jobId);
      sendSuccess(res, { message: 'Crawler stopped' });
    } catch (err) { next(err); }
  }

  static async status(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const jobId = req.query.jobId as string | undefined;
      const status = await CrawlerService.getStatus(req.user.userId, jobId);
      sendSuccess(res, status);
    } catch (err) { next(err); }
  }
}
