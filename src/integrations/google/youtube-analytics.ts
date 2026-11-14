import { google } from 'googleapis';
import { getAuthenticatedClient } from './oauth';
import prisma from '../../config/database';
import { logger } from '../../utils/logger';

export class YouTubeAnalyticsService {
  static async syncChannelMetrics(connectedAccountId: string, days = 30): Promise<void> {
    const auth = await getAuthenticatedClient(connectedAccountId);
    const youtubeAnalytics = google.youtubeAnalytics({ version: 'v2', auth });

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const { data } = await youtubeAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost,likes,dislikes,comments,shares,estimatedRevenue,impressions,annotationClickThroughRate,annotationCloseRate',
      dimensions: 'day',
      sort: 'day',
    });

    for (const row of data.rows ?? []) {
      const date = new Date(row[0] as string);
      await prisma.youTubeChannelMetric.upsert({
        where: { channelId_date: { channelId: row[1] as string, date } },
        create: {
          channelId: row[1] as string,
          date,
          views: row[2] as number ?? null,
          watchTimeMinutes: row[3] as number ?? null,
          averageViewDuration: row[4] as number ?? null,
          averageViewPercentage: row[5] as number ?? null,
          subscribersGained: row[6] as number ?? null,
          subscribersLost: row[7] as number ?? null,
          likes: row[8] as number ?? null,
          dislikes: row[9] as number ?? null,
          comments: row[10] as number ?? null,
          shares: row[11] as number ?? null,
          estimatedRevenue: row[12] as number ?? null,
          impressions: row[13] as number ?? null,
          ctr: row[14] as number ?? null,
        },
        update: {
          views: row[2] as number ?? null,
          watchTimeMinutes: row[3] as number ?? null,
          averageViewDuration: row[4] as number ?? null,
          averageViewPercentage: row[5] as number ?? null,
          subscribersGained: row[6] as number ?? null,
          subscribersLost: row[7] as number ?? null,
          likes: row[8] as number ?? null,
          dislikes: row[9] as number ?? null,
          comments: row[10] as number ?? null,
          shares: row[11] as number ?? null,
          estimatedRevenue: row[12] as number ?? null,
          impressions: row[13] as number ?? null,
          ctr: row[14] as number ?? null,
        },
      });
    }
    logger.info('Channel metrics synced', { connectedAccountId });
  }
}