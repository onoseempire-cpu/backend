import prisma from '../config/database';
import { getDateRange, getPreviousPeriod } from '../utils/date';
import { GrowthProcessor } from './processors/growth.processor';
import { TrendProcessor } from './processors/trend.processor';

export class YouTubeAnalyticsEngine {
  static async getChannelAnalytics(userId: string, period = '30d', channelId?: string) {
    const { startDate, endDate } = getDateRange(period as Parameters<typeof getDateRange>[0]);
    const { startDate: prevStart, endDate: prevEnd } = getPreviousPeriod(startDate, endDate);

    const accounts = await prisma.connectedAccount.findMany({
      where: { userId, provider: 'youtube-data', status: 'active' },
    });

    const channels = await prisma.youTubeChannel.findMany({
      where: {
        connectedAccountId: { in: accounts.map(a => a.id) },
        ...(channelId ? { channelId } : {}),
      },
    });

    const results = await Promise.all(channels.map(async (channel) => {
      const metrics = await prisma.youTubeChannelMetric.findMany({
        where: { channelId: channel.channelId, date: { gte: startDate, lte: endDate } },
        orderBy: { date: 'asc' },
      });
      const prevMetrics = await prisma.youTubeChannelMetric.findMany({
        where: { channelId: channel.channelId, date: { gte: prevStart, lte: prevEnd } },
      });

      const sum = (key: string) => metrics.reduce((s, m) => s + (((m as Record<string, unknown>)[key] as number | null) ?? 0), 0);
      const prevSum = (key: string) => prevMetrics.reduce((s, m) => s + (((m as Record<string, unknown>)[key] as number | null) ?? 0), 0);
      const growth = (curr: number, prev: number) => prev === 0 ? null : Math.round(((curr - prev) / prev) * 1000) / 10;

      const totalViews = sum('views');
      const totalWatchMin = sum('estimatedMinutesWatched');
      const subsGained = sum('subscribersGained');
      const subsLost = sum('subscribersLost');
      const hasRevenue = metrics.some(m => m.estimatedRevenue !== null);

      return {
        channel: {
          id: channel.channelId, title: channel.title,
          thumbnailUrl: channel.thumbnailUrl, subscriberCount: channel.subscriberCount,
          viewCount: channel.viewCount, videoCount: channel.videoCount,
        },
        period: { startDate, endDate },
        totals: {
          views: totalViews, viewsGrowth: growth(totalViews, prevSum('views')),
          watchTimeMinutes: totalWatchMin, watchTimeHours: Math.round(totalWatchMin / 60),
          watchTimeGrowth: growth(totalWatchMin, prevSum('estimatedMinutesWatched')),
          subscribersGained: subsGained, subscribersLost: subsLost,
          netSubscribers: subsGained - subsLost,
          subscribersGrowth: growth(subsGained, prevSum('subscribersGained')),
          likes: sum('likes'), comments: sum('comments'), shares: sum('shares'),
          estimatedRevenue: hasRevenue ? sum('estimatedRevenue') : null,
          impressions: metrics.some(m => m.impressions !== null) ? sum('impressions') : null,
          avgCTR: metrics.some(m => m.impressionClickThroughRate !== null)
            ? metrics.filter(m => m.impressionClickThroughRate !== null).reduce((s, m) => s + (m.impressionClickThroughRate ?? 0), 0) / metrics.filter(m => m.impressionClickThroughRate !== null).length
            : null,
        },
        chartData: metrics.map(m => ({
          date: m.date, views: m.views ?? 0,
          watchTime: m.estimatedMinutesWatched ?? 0,
          subscribers: (m.subscribersGained ?? 0) - (m.subscribersLost ?? 0),
          revenue: m.estimatedRevenue ?? null,
          impressions: m.impressions ?? null,
          ctr: m.impressionClickThroughRate ?? null,
        })),
        trend: TrendProcessor.analyze(metrics.map(m => ({ date: m.date, value: m.views ?? 0 }))),
      };
    }));

    return { channels: results, period: { startDate, endDate } };
  }

  static async getVideoPerformance(userId: string, channelId?: string, limit = 50, sortBy = 'viewCount') {
    const accounts = await prisma.connectedAccount.findMany({
      where: { userId, provider: 'youtube-data', status: 'active' },
    });
    const channels = await prisma.youTubeChannel.findMany({
      where: { connectedAccountId: { in: accounts.map(a => a.id) }, ...(channelId ? { channelId } : {}) },
    });

    const videos = await prisma.youTubeVideo.findMany({
      where: { channelId: { in: channels.map(c => c.channelId) } },
      orderBy: { [sortBy === 'viewCount' ? 'viewCount' : sortBy === 'likeCount' ? 'likeCount' : 'publishedAt']: 'desc' },
      take: limit,
    });

    return videos.map(v => ({
      videoId: v.videoId, title: v.title,
      thumbnailUrl: v.thumbnailUrl, publishedAt: v.publishedAt?.toISOString() ?? null,
      duration: v.duration, viewCount: v.viewCount ?? 0,
      likeCount: v.likeCount ?? 0, commentCount: v.commentCount ?? 0,
    }));
  }
}
