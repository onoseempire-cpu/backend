import { Response, NextFunction } from 'express';
import { OverviewAnalytics } from '../analytics/overview.analytics';
import { YouTubeAnalyticsEngine } from '../analytics/youtube.analytics';
import { GoogleAnalyticsEngine } from '../analytics/google-analytics.analytics';
import { sendSuccess } from '../utils/api-response';
import type { AuthenticatedRequest } from '../types/auth';

export class AnalyticsController {
  static async overview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const period = (req.query.period as string) ?? '30d';
      const data = await OverviewAnalytics.getOverview(req.user.userId, period);
      sendSuccess(res, data, 200, { lastSync: data.lastSyncAt ?? null, reportingDelay: 'Up to 48 hours' });
    } catch (err) { next(err); }
  }

  static async youtube(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { period = '30d', channelId } = req.query as Record<string, string>;
      const data = await YouTubeAnalyticsEngine.getChannelAnalytics(req.user.userId, period, channelId);
      sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  static async youtubeVideos(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { channelId, limit = '50', sortBy = 'viewCount' } = req.query as Record<string, string>;
      const data = await YouTubeAnalyticsEngine.getVideoPerformance(req.user.userId, channelId, parseInt(limit), sortBy);
      sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  static async googleAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { period = '30d', propertyId } = req.query as Record<string, string>;
      const data = await GoogleAnalyticsEngine.getPropertyAnalytics(req.user.userId, period, propertyId);
      sendSuccess(res, data);
    } catch (err) { next(err); }
  }
}
