import { Response, NextFunction } from 'express';
import { OverviewAnalytics } from '../analytics/overview.analytics';
import { YouTubeAnalyticsEngine } from '../analytics/youtube.analytics';
import { GoogleAnalyticsEngine } from '../analytics/google-analytics.analytics';
import { sendSuccess } from '../utils/api-response';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';

export class AnalyticsController {
  static async overview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const period = (req.query.period as string) ?? '30d';
      const data = await OverviewAnalytics.getOverview(userId, period);
      sendSuccess(res, data, 200, { lastSync: data.lastSyncAt ?? null, reportingDelay: 'Up to 48 hours' });
    } catch (err) { next(err); }
  }

  static async youtube(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { period = '30d', channelId } = req.query as Record<string, string>;
      const data = await YouTubeAnalyticsEngine.getChannelAnalytics(userId, period, channelId);
      sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  static async youtubeVideos(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { channelId, limit = '50', sortBy = 'viewCount' } = req.query as Record<string, string>;
      const data = await YouTubeAnalyticsEngine.getVideoPerformance(userId, channelId, parseInt(limit), sortBy);
      sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  static async googleAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { period = '30d', propertyId } = req.query as Record<string, string>;
      const data = await GoogleAnalyticsEngine.getPropertyAnalytics(userId, period, propertyId);
      sendSuccess(res, data);
    } catch (err) { next(err); }
  }
}