import { google } from 'googleapis';
import { getAuthenticatedClient } from './oauth';
import prisma from '../../config/database';
import { logger } from '../../utils/logger';

export class YouTubeAnalyticsService {
  static async syncChannelMetrics(connectedAccountId: string, days = 30): Promise<void> {
    const auth = await getAuthenticatedClient(connectedAccountId);
    const youtubeAnalytics = google.youtubeAnalytics({ version: 'v2', auth });

    const channels = await prisma.youTubeChannel.findMany({
      where: { connectedAccountId },
      select: { channelId: true },
    });
    if (channels.length === 0) {
      logger.warn('No YouTube channels found for analytics sync', { connectedAccountId });
      return;
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const formatDate = (d: Date) => d.toISOString().slice(0, 10);

    const { data } = await youtubeAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      // Keep this list aligned with YouTubeChannelMetric in schema.prisma.
      metrics: 'views,estimatedMinutesWatched,subscribersGained,subscribersLost,likes,comments,shares,estimatedRevenue,impressions,impressionClickThroughRate',
      dimensions: 'day',
      sort: 'day',
    });

    for (const channel of channels) {
      for (const row of data.rows ?? []) {
        const date = new Date(String(row[0]));
        if (Number.isNaN(date.getTime())) continue;
        const numberAt = (index: number): number | null => {
          const value = row[index];
          if (value === null || value === undefined || value === '') return null;
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : null;
        };

        const metricData = {
          views: numberAt(1),
          watchTimeMinutes: numberAt(2),
          subscribersGained: numberAt(3),
          subscribersLost: numberAt(4),
          likes: numberAt(5),
          comments: numberAt(6),
          shares: numberAt(7),
          estimatedRevenue: numberAt(8),
          impressions: numberAt(9),
          ctr: numberAt(10),
        };

        await prisma.youTubeChannelMetric.upsert({
          where: { channelId_date: { channelId: channel.channelId, date } },
          create: { channelId: channel.channelId, date, ...metricData },
          update: metricData,
        });
      }
    }

    logger.info('YouTube channel metrics synced', { connectedAccountId, channels: channels.length });
  }
}
