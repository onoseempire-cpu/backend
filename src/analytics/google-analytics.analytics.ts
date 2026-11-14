import prisma from '../config/database';
import { GAPropertySummary, GAMetricTotals, GAChartPoint, GAPropertyAnalytics } from '../types/api';

export class GoogleAnalyticsEngine {
  static async getPropertyAnalytics(userId: string, period: string, propertyId?: string): Promise<any[]> {
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

    // Get user's GA accounts
    const accounts = await prisma.connectedAccount.findMany({
      where: { userId, provider: 'GOOGLE_ANALYTICS', status: 'active' },
      select: { id: true },
    });

    if (accounts.length === 0) return [];

    const accountIds = accounts.map(a => a.id);
    let properties = await prisma.googleAnalyticsProperty.findMany({
      where: { connectedAccountId: { in: accountIds } },
    });

    if (propertyId) {
      properties = properties.filter(p => p.propertyId === propertyId);
    }

    const results: any[] = [];

    for (const prop of properties) {
      const metrics = await prisma.analyticsMetric.findMany({
        where: { sourceType: 'GOOGLE_ANALYTICS', entityId: prop.propertyId, date: { gte: startDate } },
        orderBy: { date: 'asc' },
      });

      if (metrics.length === 0) continue;

      const totals: any = {
        sessions: metrics.reduce((sum, m) => sum + (m.value || 0), 0),
        sessionsGrowth: null,
        users: metrics.reduce((sum, m) => sum + (m.value || 0), 0),
        usersGrowth: null,
        newUsers: 0,
        pageViews: 0,
        pageViewsGrowth: null,
        avgBounceRate: null,
        avgEngagementRate: null,
        conversions: 0,
      };

      const chartData: any[] = metrics.map(m => ({
        date: m.date.toISOString().split('T')[0],
        sessions: m.value || 0,
        users: m.value || 0,
        pageViews: 0,
        bounceRate: null,
        engagementRate: null,
      }));

      const propertySummary: any = {
        id: prop.id,
        displayName: prop.displayName || prop.name || 'Unknown',
        timezone: prop.timezone,
      };

      results.push({
        property: propertySummary,
        period: { startDate: startDate.toISOString(), endDate: now.toISOString() },
        totals,
        chartData,
        topSources: [],
        topPages: [],
      });
    }

    return results;
  }
}
