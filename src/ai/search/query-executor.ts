import prisma from '../config/database';
import type { ParsedQuery } from './query-parser';

export interface QueryResult {
  data: Record<string, unknown> | null;
  found: boolean;
  disclaimer?: string | null;
  source: string;
  period: { startDate: string; endDate: string };
  value?: number | null;
  unit?: string;
  rows?: Array<Record<string, unknown>>;
  chartData?: Array<{ date: string; value: number }>;
  comparisonData?: {
    current: number;
    previous: number;
    change: number;
    changePercent: number | null;
    currentPeriod: string;
    previousPeriod: string;
  };
}

const sum = (values: Array<number | null | undefined>): number =>
  values.reduce<number>((total, value) => total + (value ?? 0), 0);

const metricForIntent: Record<string, { key: string; unit: string }> = {
  get_views: { key: 'views', unit: 'views' },
  get_watch_time: { key: 'watchTimeMinutes', unit: 'minutes' },
  get_subscribers: { key: 'netSubscribers', unit: 'subscribers' },
  get_revenue: { key: 'estimatedRevenue', unit: 'USD' },
  get_impressions: { key: 'impressions', unit: 'impressions' },
  get_ctr: { key: 'avgCTR', unit: '%' },
  get_likes: { key: 'likes', unit: 'likes' },
  get_comments: { key: 'comments', unit: 'comments' },
  get_shares: { key: 'shares', unit: 'shares' },
  get_sessions: { key: 'sessions', unit: 'sessions' },
  get_users: { key: 'users', unit: 'users' },
};

export async function executeQuery(userId: string, parsed: ParsedQuery): Promise<QueryResult> {
  const now = new Date();
  const days = parsed.period === '7d' ? 7 : parsed.period === '90d' ? 90 : parsed.period === '365d' ? 365 : 30;
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const dateRange = { gte: startDate, lte: now };

  const includeYouTube = parsed.source === 'youtube' || parsed.source === 'any' || parsed.source === 'both';
  const includeGA = parsed.source === 'google-analytics' || parsed.source === 'any' || parsed.source === 'both';
  const resultData: Record<string, unknown> = {};
  let youtubeTotals: Record<string, number | null> | null = null;
  let gaTotals: Record<string, number | null> | null = null;
  let rows: Array<Record<string, unknown>> = [];
  let chartData: Array<{ date: string; value: number }> = [];

  if (includeYouTube) {
    const accounts = await prisma.connectedAccount.findMany({
      where: { userId, provider: 'YOUTUBE', status: 'active' },
      select: { id: true },
    });
    const channels = accounts.length
      ? await prisma.youTubeChannel.findMany({
          where: {
            connectedAccountId: { in: accounts.map(account => account.id) },
            ...(parsed.channelId ? { channelId: parsed.channelId } : {}),
          },
          select: { channelId: true },
        })
      : [];
    const metrics = channels.length
      ? await prisma.youTubeChannelMetric.findMany({
          where: { channelId: { in: channels.map(channel => channel.channelId) }, date: dateRange },
          orderBy: { date: 'asc' },
        })
      : [];

    if (metrics.length) {
      const views = sum(metrics.map(m => m.views));
      const watchTimeMinutes = sum(metrics.map(m => m.watchTimeMinutes));
      const subscribersGained = sum(metrics.map(m => m.subscribersGained));
      const subscribersLost = sum(metrics.map(m => m.subscribersLost));
      youtubeTotals = {
        views,
        watchTimeMinutes,
        netSubscribers: subscribersGained - subscribersLost,
        subscribersGained,
        subscribersLost,
        likes: sum(metrics.map(m => m.likes)),
        comments: sum(metrics.map(m => m.comments)),
        shares: sum(metrics.map(m => m.shares)),
        estimatedRevenue: metrics.some(m => m.estimatedRevenue !== null) ? sum(metrics.map(m => m.estimatedRevenue)) : null,
        impressions: metrics.some(m => m.impressions !== null) ? sum(metrics.map(m => m.impressions)) : null,
        avgCTR: metrics.some(m => m.ctr !== null)
          ? sum(metrics.map(m => m.ctr)) / metrics.filter(m => m.ctr !== null).length
          : null,
      };
      resultData.youtube = { totals: youtubeTotals };
      rows = metrics.map(m => ({
        date: m.date.toISOString().slice(0, 10),
        views: m.views,
        watchTimeMinutes: m.watchTimeMinutes,
        subscribersGained: m.subscribersGained,
        subscribersLost: m.subscribersLost,
      }));
      chartData = metrics.map(m => ({
        date: m.date.toISOString().slice(0, 10),
        value: m.views ?? 0,
      }));
    }
  }

  if (includeGA) {
    const accounts = await prisma.connectedAccount.findMany({
      where: { userId, provider: 'GOOGLE_ANALYTICS', status: 'active' },
      select: { id: true },
    });
    const properties = accounts.length
      ? await prisma.googleAnalyticsProperty.findMany({
          where: {
            connectedAccountId: { in: accounts.map(account => account.id) },
            ...(parsed.propertyId ? { propertyId: parsed.propertyId } : {}),
          },
          select: { propertyId: true },
        })
      : [];
    const metrics = properties.length
      ? await prisma.googleAnalyticsMetric.findMany({
          where: { propertyId: { in: properties.map(property => property.propertyId) }, date: dateRange },
          orderBy: { date: 'asc' },
        })
      : [];

    if (metrics.length) {
      gaTotals = {
        sessions: sum(metrics.map(m => m.sessions)),
        users: sum(metrics.map(m => m.users)),
        newUsers: sum(metrics.map(m => m.newUsers)),
        pageViews: sum(metrics.map(m => m.pageViews)),
        avgBounceRate: metrics.some(m => m.bounceRate !== null)
          ? sum(metrics.map(m => m.bounceRate)) / metrics.filter(m => m.bounceRate !== null).length
          : null,
        avgEngagementRate: metrics.some(m => m.engagementRate !== null)
          ? sum(metrics.map(m => m.engagementRate)) / metrics.filter(m => m.engagementRate !== null).length
          : null,
        conversions: sum(metrics.map(m => m.conversions)),
      };
      resultData.googleAnalytics = { totals: gaTotals };
      rows = metrics.map(m => ({
        date: m.date.toISOString().slice(0, 10),
        sessions: m.sessions,
        users: m.users,
        newUsers: m.newUsers,
        pageViews: m.pageViews,
      }));
      chartData = metrics.map(m => ({
        date: m.date.toISOString().slice(0, 10),
        value: m.sessions ?? 0,
      }));
    }
  }

  const intentMetric = metricForIntent[parsed.intent];
  const gaIntent = ['get_sessions', 'get_users', 'get_top_pages', 'get_traffic_sources'].includes(parsed.intent);
  const selectedTotals = gaIntent || parsed.source === 'google-analytics'
    ? gaTotals
    : youtubeTotals ?? gaTotals;
  const value = intentMetric && selectedTotals
    ? selectedTotals[intentMetric.key] ?? null
    : null;
  const sourceLabel = youtubeTotals && gaTotals ? 'YouTube and Google Analytics'
    : youtubeTotals ? 'YouTube Analytics'
    : gaTotals ? 'Google Analytics'
    : 'Connected analytics';
  const found = Boolean(youtubeTotals || gaTotals);

  return {
    data: found ? resultData : null,
    found,
    source: sourceLabel,
    period: { startDate: startDate.toISOString().slice(0, 10), endDate: now.toISOString().slice(0, 10) },
    value,
    unit: intentMetric?.unit,
    rows: rows.length ? rows : undefined,
    chartData: chartData.length ? chartData : undefined,
    disclaimer: found ? null : 'No analytics data was found for the selected source and period.',
  };
}
