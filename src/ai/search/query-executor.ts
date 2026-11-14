import prisma from '../../config/database';
import { ParsedQuery, QueryIntent } from './query-parser';

interface YouTubeMetricRow {
  date: Date;
  views: number | null;
  watchTimeMinutes: number | null;
  subscribersGained: number | null;
  subscribersLost: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  estimatedRevenue: number | null;
  impressions: number | null;
  ctr: number | null;
}

interface GAMetricRow {
  date: Date;
  sessions: number | null;
  users: number | null;
  newUsers: number | null;
  pageViews: number | null;
  bounceRate: number | null;
  engagementRate: number | null;
  conversions: number | null;
}

export async function executeQuery(userId: string, parsed: ParsedQuery) {
  const { intent, source, period, channelId, propertyId } = parsed;

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

  let data: any = null;
  let found = false;

  if (source === 'youtube' || source === 'both') {
    const accounts = await prisma.connectedAccount.findMany({
      where: { userId, provider: 'YOUTUBE', status: 'active' },
      select: { id: true },
    });

    if (accounts.length > 0) {
      const accountIds = accounts.map(a => a.id);
      let channels = await prisma.youTubeChannel.findMany({
        where: { connectedAccountId: { in: accountIds } },
      });

      if (channelId) {
        channels = channels.filter(c => c.channelId === channelId);
      }

      const channelIds = channels.map(c => c.channelId);
      const metrics = await prisma.youTubeChannelMetric.findMany({
        where: { channelId: { in: channelIds }, date: { gte: startDate } },
        orderBy: { date: 'asc' },
      }) as YouTubeMetricRow[];

      if (metrics.length > 0) {
        found = true;
        data = data || {};
        data.youtube = {
          totals: {
            views: metrics.reduce((sum, m) => sum + (m.views || 0), 0),
            watchTimeMinutes: metrics.reduce((sum, m) => sum + (m.watchTimeMinutes || 0), 0),
            subscribersGained: metrics.reduce((sum, m) => sum + (m.subscribersGained || 0), 0),
            subscribersLost: metrics.reduce((sum, m) => sum + (m.subscribersLost || 0), 0),
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
          },
          chartData: metrics.map(m => ({
            date: m.date.toISOString().split('T')[0],
            views: m.views || 0,
            watchTime: m.watchTimeMinutes || 0,
            subscribers: (m.subscribersGained || 0) - (m.subscribersLost || 0),
            revenue: m.estimatedRevenue || null,
            impressions: m.impressions || null,
            ctr: m.ctr || null,
          })),
        };
      }
    }
  }

  if (source === 'google-analytics' || source === 'both') {
    const accounts = await prisma.connectedAccount.findMany({
      where: { userId, provider: 'GOOGLE_ANALYTICS', status: 'active' },
      select: { id: true },
    });

    if (accounts.length > 0) {
      const accountIds = accounts.map(a => a.id);
      let properties = await prisma.googleAnalyticsProperty.findMany({
        where: { connectedAccountId: { in: accountIds } },
      });

      if (propertyId) {
        properties = properties.filter(p => p.propertyId === propertyId);
      }

      const propIds = properties.map(p => p.propertyId);
      const metrics = await prisma.analyticsMetric.findMany({
        where: {
          sourceType: 'GOOGLE_ANALYTICS',
          entityId: { in: propIds },
          date: { gte: startDate },
        },
        orderBy: { date: 'asc' },
      }) as GAMetricRow[];

      if (metrics.length > 0) {
        found = true;
        data = data || {};
        data.googleAnalytics = {
          totals: {
            sessions: metrics.reduce((sum, m) => sum + (m.sessions || 0), 0),
            users: metrics.reduce((sum, m) => sum + (m.users || 0), 0),
            newUsers: metrics.reduce((sum, m) => sum + (m.newUsers || 0), 0),
            pageViews: metrics.reduce((sum, m) => sum + (m.pageViews || 0), 0),
            avgBounceRate: metrics.some(m => m.bounceRate !== null)
              ? metrics.reduce((sum, m) => sum + (m.bounceRate || 0), 0) / metrics.filter(m => m.bounceRate !== null).length
              : null,
            avgEngagementRate: metrics.some(m => m.engagementRate !== null)
              ? metrics.reduce((sum, m) => sum + (m.engagementRate || 0), 0) / metrics.filter(m => m.engagementRate !== null).length
              : null,
            conversions: metrics.reduce((sum, m) => sum + (m.conversions || 0), 0),
          },
          chartData: metrics.map(m => ({
            date: m.date.toISOString().split('T')[0],
            sessions: m.sessions || 0,
            users: m.users || 0,
            pageViews: m.pageViews || 0,
            bounceRate: m.bounceRate || null,
            engagementRate: m.engagementRate || null,
          })),
        };
      }
    }
  }

  return { data, found };
}