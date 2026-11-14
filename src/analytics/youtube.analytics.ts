import prisma from '../../config/database';
import { YouTubeChannelSummary, YouTubeMetricTotals, YouTubeChartPoint, YouTubeTrend, YouTubeChannelAnalytics } from '../../types/api';
import { TrendProcessor } from '../processors/trend.processor';

export class YouTubeAnalyticsEngine {
  static async getChannelAnalytics(userId: string, period: string, channelId?: string): Promise<YouTubeChannelAnalytics[]> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get user's YouTube accounts
    const accounts = await prisma.connectedAccount.findMany({
      where: { userId, provider: 'YOUTUBE', status: 'active' },
      select: { id: true },
    });

    if (accounts.length === 0) return [];

    const accountIds = accounts.map(a => a.id);
    let channels = await prisma.youTubeChannel.findMany({
      where: { connectedAccountId: { in: accounts.map(a => a.id) } },
    });

    if (channelId) {
      channels = channels.filter(c => c.channelId === channelId);
    }

    const results: YouTubeChannelAnalytics[] = [];

    for (const channel of channels) {
      const metrics = await prisma.youTubeChannelMetric.findMany({
        where: { channelId: channel.channelId, date: { gte: startDate } },
        orderBy: { date: 'asc' },
      });

      if (metrics.length === 0) continue;

      // Totals
      const totals: YouTubeMetricTotals = {
        views: metrics.reduce((sum, m) => sum + (m.views || 0), 0),
        viewsGrowth: null,
        watchTimeMinutes: metrics.reduce((sum, m) => sum + (m.watchTimeMinutes || 0), 0),
        watchTimeHours: Math.round(metrics.reduce((sum, m) => sum + (m.watchTimeMinutes || 0), 0) / 60),
        watchTimeGrowth: null,
        subscribersGained: metrics.reduce((sum, m) => sum + (m.subscribersGained || 0), 0),
        subscribersLost: metrics.reduce((sum, m) => sum + (m.subscribersLost || 0), 0),
        netSubscribers: metrics.reduce((sum, m) => sum + ((m.subscribersGained || 0) - (m.subscribersLost || 0)), 0),
        subscribersGrowth: null,
        likes: metrics.reduce((sum, m) => sum + (m.likes || 0), 0),
        comments: metrics.reduce((sum, m) => sum + (m.comments || 0), 0),
        shares: metrics.reduce((sum, m) => sum + (m.shares || 0), 0),
        estimatedRevenue: metrics.some(m => m.estimatedRevenue !== null)
          ? metrics.reduce((sum, m) => sum + (m.estimatedRevenue || 0), 0)
          : null,
        impressions: metrics.some(m => m.impressions !== null)
          ? metrics.reduce((sum, m) => sum + (m.impressions || 0), 0)
          : null,
        avgCTR: metrics.some(m => m.ctr !== null)
          ? metrics.reduce((sum, m) => sum + (m.ctr || 0), 0) / metrics.filter(m => m.ctr !== null).length
          : null,
      };

      // Chart data
      const chartData: YouTubeChartPoint[] = metrics.map(m => ({
        date: m.date.toISOString().split('T')[0],
        views: m.views || 0,
        watchTime: m.watchTimeMinutes || 0,
        subscribers: (m.subscribersGained || 0) - (m.subscribersLost || 0),
        revenue: m.estimatedRevenue || null,
        impressions: m.impressions || null,
        ctr: m.ctr || null,
      }));

      // Trend
      const trend = TrendProcessor.analyze(metrics.map(m => ({ date: m.date.toISOString().split('T')[0], value: m.views || 0 })));

      const channelSummary: YouTubeChannelSummary = {
        id: channel.id,
        title: channel.title || 'Unknown',
        thumbnailUrl: channel.thumbnailUrl,
        subscriberCount: channel.subscriberCount ? Number(channel.subscriberCount) : null,
        viewCount: channel.viewCount ? Number(channel.viewCount) : null,
        videoCount: channel.videoCount,
      };

      results.push({
        channel: channelSummary,
        period: { startDate: startDate.toISOString(), endDate: now.toISOString() },
        totals,
        chartData,
        trend,
      });
    }

    return results;
  }

  static async getVideoPerformance(userId: string, channelId?: string, limit = 50, sortBy = 'viewCount') {
    const accounts = await prisma.connectedAccount.findMany({
      where: { userId, provider: 'YOUTUBE', status: 'active' },
      select: { id: true },
    });

    if (accounts.length === 0) return [];

    const accountIds = accounts.map(a => a.id);
    const where: any = { channel: { connectedAccountId: { in: accountIds } } };
    if (channelId) where.channelId = channelId;

    const videos = await prisma.youTubeVideo.findMany({
      where,
      orderBy: { [sortBy]: 'desc' },
      take: limit,
      select: { videoId: true, title: true, thumbnailUrl: true, publishedAt: true, duration: true, viewCount: true, likeCount: true, commentCount: true },
    });

    return videos.map(v => ({
      videoId: v.videoId,
      title: v.title || 'Untitled',
      thumbnailUrl: v.thumbnailUrl,
      publishedAt: v.publishedAt?.toISOString() ?? null,
      duration: v.duration,
      viewCount: Number(v.viewCount || 0),
      likeCount: Number(v.likeCount || 0),
      commentCount: Number(v.commentCount || 0),
    }));
  }
}