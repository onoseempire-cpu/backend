import prisma from '../config/database';
import { getDateRange, getPreviousPeriod } from '../utils/date';

export class GoogleAnalyticsEngine {
  static async getPropertyAnalytics(userId: string, period = '30d', propertyId?: string) {
    const { startDate, endDate } = getDateRange(period as Parameters<typeof getDateRange>[0]);
    const { startDate: prevStart, endDate: prevEnd } = getPreviousPeriod(startDate, endDate);

    const accounts = await prisma.connectedAccount.findMany({
      where: { userId, provider: 'google-analytics', status: 'active' },
    });
    const properties = await prisma.googleAnalyticsProperty.findMany({
      where: { connectedAccountId: { in: accounts.map(a => a.id) }, ...(propertyId ? { propertyId } : {}) },
    });

    const results = await Promise.all(properties.map(async (prop) => {
      const metrics = await prisma.googleAnalyticsMetric.findMany({
        where: { propertyId: prop.propertyId, date: { gte: startDate, lte: endDate } },
        orderBy: { date: 'asc' },
      });
      const prevMetrics = await prisma.googleAnalyticsMetric.findMany({
        where: { propertyId: prop.propertyId, date: { gte: prevStart, lte: prevEnd } },
      });

      const sum = (key: keyof typeof metrics[0]) => metrics.reduce((s, m) => s + ((m[key] as number | null) ?? 0), 0);
      const prevSum = (key: keyof typeof prevMetrics[0]) => prevMetrics.reduce((s, m) => s + ((m[key] as number | null) ?? 0), 0);
      const growth = (c: number, p: number) => p === 0 ? null : Math.round(((c - p) / p) * 1000) / 10;

      const totalSessions = sum('sessions');
      const totalUsers = sum('users');
      const totalPageViews = sum('pageViews');

      // Aggregate traffic sources from JSON
      const sourceMap = new Map<string, number>();
      for (const m of metrics) {
        if (!m.source) continue;
        try {
          const sources = JSON.parse(m.source) as [string, number][];
          for (const [src, count] of sources) {
            sourceMap.set(src, (sourceMap.get(src) ?? 0) + count);
          }
        } catch { /* skip */ }
      }
      const topSources = [...sourceMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([source, sessions]) => ({ source, sessions }));

      // Top pages from latest entry
      const latestWithPages = [...metrics].reverse().find(m => m.topPages);
      const topPages = latestWithPages?.topPages ? JSON.parse(latestWithPages.topPages) : [];

      return {
        property: { id: prop.propertyId, displayName: prop.displayName, timezone: prop.timezone },
        period: { startDate, endDate },
        totals: {
          sessions: totalSessions, sessionsGrowth: growth(totalSessions, prevSum('sessions')),
          users: totalUsers, usersGrowth: growth(totalUsers, prevSum('users')),
          newUsers: sum('newUsers'), pageViews: totalPageViews,
          pageViewsGrowth: growth(totalPageViews, prevSum('pageViews')),
          avgBounceRate: metrics.length ? sum('bounceRate') / metrics.length : null,
          avgEngagementRate: metrics.length ? sum('engagementRate') / metrics.length : null,
          conversions: sum('conversions'),
        },
        chartData: metrics.map(m => ({
          date: m.date, sessions: m.sessions ?? 0, users: m.activeUsers ?? 0,
          pageViews: m.pageViews ?? 0, bounceRate: m.bounceRate ?? null,
          engagementRate: m.engagementRate ?? null,
        })),
        topSources, topPages,
      };
    }));

    return { properties: results, period: { startDate, endDate } };
  }
}
