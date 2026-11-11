import { google } from 'googleapis';
import { getAuthenticatedClient } from './oauth';
import prisma from '../../config/database';
import { logger } from '../../utils/logger';

export class YouTubeAnalyticsService {
  static async syncChannelMetrics(connectedAccountId: string, startDate: string, endDate: string): Promise<void> {
    const auth = await getAuthenticatedClient(connectedAccountId);
    const yta = google.youtubeAnalytics({ version: 'v2', auth });
    const channels = await prisma.youTubeChannel.findMany({ where: { connectedAccountId } });

    for (const channel of channels) {
      // Basic viewership metrics
      try {
        const basic = await yta.reports.query({
          ids: `channel==${channel.channelId}`, startDate, endDate,
          metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost,shares,likes,dislikes,comments',
          dimensions: 'day', sort: 'day',
        });
        await this.storeRows(channel.channelId, basic.data);
      } catch (err) {
        logger.warn('Basic metrics error', { channelId: channel.channelId, error: (err as Error).message });
      }

      // Revenue (may fail if not monetized)
      try {
        const rev = await yta.reports.query({
          ids: `channel==${channel.channelId}`, startDate, endDate,
          metrics: 'estimatedRevenue,estimatedAdRevenue,grossRevenue,monetizedPlaybacks,cpm,adImpressions',
          dimensions: 'day', sort: 'day',
        });
        await this.storeRows(channel.channelId, rev.data, true);
      } catch {
        logger.debug('Revenue metrics not available (channel not monetized)', { channelId: channel.channelId });
      }

      // Impressions (may require extra permission)
      try {
        const imp = await yta.reports.query({
          ids: `channel==${channel.channelId}`, startDate, endDate,
          metrics: 'impressions,impressionClickThroughRate',
          dimensions: 'day', sort: 'day',
        });
        await this.storeRows(channel.channelId, imp.data, false, true);
      } catch {
        logger.debug('Impression metrics not available', { channelId: channel.channelId });
      }
    }
  }

  private static async storeRows(
    channelId: string,
    data: { columnHeaders?: Array<{ name?: string | null }> | null; rows?: Array<Array<string | number>> | null },
    isRevenue = false,
    isImpression = false
  ) {
    if (!data.rows || !data.columnHeaders) return;
    const h = data.columnHeaders.map(c => c.name ?? '');
    const idx = (n: string) => h.indexOf(n);
    const num = (row: Array<string | number>, n: string) => {
      const i = idx(n); return i >= 0 ? (row[i] as number) || null : null;
    };

    for (const row of data.rows) {
      const date = row[idx('day')] as string;
      if (!date) continue;

      if (isRevenue) {
        await prisma.youTubeChannelMetric.upsert({
          where: { channelId_date: { channelId, date } },
          create: { channelId, date, estimatedRevenue: num(row, 'estimatedRevenue'), estimatedAdRevenue: num(row, 'estimatedAdRevenue'), grossRevenue: num(row, 'grossRevenue'), monetizedPlaybacks: num(row, 'monetizedPlaybacks'), cpm: num(row, 'cpm'), adImpressions: num(row, 'adImpressions') },
          update: { estimatedRevenue: num(row, 'estimatedRevenue'), estimatedAdRevenue: num(row, 'estimatedAdRevenue'), grossRevenue: num(row, 'grossRevenue'), monetizedPlaybacks: num(row, 'monetizedPlaybacks'), cpm: num(row, 'cpm'), adImpressions: num(row, 'adImpressions') },
        });
      } else if (isImpression) {
        await prisma.youTubeChannelMetric.upsert({
          where: { channelId_date: { channelId, date } },
          create: { channelId, date, impressions: num(row, 'impressions'), impressionClickThroughRate: num(row, 'impressionClickThroughRate') },
          update: { impressions: num(row, 'impressions'), impressionClickThroughRate: num(row, 'impressionClickThroughRate') },
        });
      } else {
        await prisma.youTubeChannelMetric.upsert({
          where: { channelId_date: { channelId, date } },
          create: { channelId, date, views: num(row, 'views'), estimatedMinutesWatched: num(row, 'estimatedMinutesWatched'), averageViewDuration: num(row, 'averageViewDuration'), averageViewPercentage: num(row, 'averageViewPercentage'), subscribersGained: num(row, 'subscribersGained'), subscribersLost: num(row, 'subscribersLost'), shares: num(row, 'shares'), likes: num(row, 'likes'), dislikes: num(row, 'dislikes'), comments: num(row, 'comments') },
          update: { views: num(row, 'views'), estimatedMinutesWatched: num(row, 'estimatedMinutesWatched'), averageViewDuration: num(row, 'averageViewDuration'), averageViewPercentage: num(row, 'averageViewPercentage'), subscribersGained: num(row, 'subscribersGained'), subscribersLost: num(row, 'subscribersLost'), shares: num(row, 'shares'), likes: num(row, 'likes'), dislikes: num(row, 'dislikes'), comments: num(row, 'comments') },
        });
      }
    }
  }

  static async getChannelMetrics(channelId: string, startDate: string, endDate: string) {
    const metrics = await prisma.youTubeChannelMetric.findMany({
      where: { channelId, date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'asc' },
    });
    const sum = (key: keyof typeof metrics[0]) => metrics.reduce((s, m) => s + ((m[key] as number | null) ?? 0), 0);
    return {
      metrics,
      totals: {
        views: sum('views'), estimatedMinutesWatched: sum('estimatedMinutesWatched'),
        subscribersGained: sum('subscribersGained'), subscribersLost: sum('subscribersLost'),
        netSubscribers: sum('subscribersGained') - sum('subscribersLost'),
        likes: sum('likes'), comments: sum('comments'), shares: sum('shares'),
        estimatedRevenue: metrics.some(m => m.estimatedRevenue !== null) ? sum('estimatedRevenue') : null,
        impressions: metrics.some(m => m.impressions !== null) ? sum('impressions') : null,
      },
    };
  }
}
