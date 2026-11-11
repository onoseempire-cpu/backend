import { google } from 'googleapis';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { getAuthenticatedClient } from './oauth';
import prisma from '../../config/database';
import { logger } from '../../utils/logger';

export class GoogleAnalyticsService {
  /**
   * List all accessible GA4 properties for the connected account
   */
  static async listProperties(connectedAccountId: string): Promise<void> {
    const auth = await getAuthenticatedClient(connectedAccountId);
    const analyticsAdmin = google.analyticsadmin({ version: 'v1beta', auth });

    try {
      const response = await analyticsAdmin.properties.list({
        filter: 'parent:accounts/-',
        pageSize: 200,
      });

      const properties = response.data.properties ?? [];
      logger.info(`Found ${properties.length} GA4 properties`, { connectedAccountId });

      for (const prop of properties) {
        if (!prop.name) continue;

        await prisma.googleAnalyticsProperty.upsert({
          where: { propertyId: prop.name },
          create: {
            connectedAccountId,
            propertyId: prop.name,
            displayName: prop.displayName ?? 'Unknown Property',
            timezone: prop.timeZone ?? null,
            currencyCode: prop.currencyCode ?? null,
            industryCategory: prop.industryCategory ?? null,
            serviceLevel: prop.serviceLevel ?? null,
            createTime: prop.createTime ? new Date(prop.createTime) : null,
            lastFetchedAt: new Date(),
          },
          update: {
            displayName: prop.displayName ?? undefined,
            timezone: prop.timeZone ?? undefined,
            lastFetchedAt: new Date(),
          },
        });
      }
    } catch (err) {
      logger.error('Failed to list GA4 properties', { error: err, connectedAccountId });
      throw err;
    }
  }

  /**
   * Sync GA4 metrics for a property over a date range
   */
  static async syncPropertyMetrics(
    connectedAccountId: string,
    propertyId: string,
    startDate: string,
    endDate: string
  ): Promise<void> {
    const auth = await getAuthenticatedClient(connectedAccountId);

    // GA4 Data API uses service account or OAuth2
    const client = new BetaAnalyticsDataClient({ authClient: auth as never });

    logger.info(`Syncing GA4 metrics for ${propertyId}`, { startDate, endDate });

    try {
      const [response] = await client.runReport({
        property: propertyId,
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'date' },
          { name: 'sessionSource' },
          { name: 'sessionMedium' },
          { name: 'country' },
          { name: 'deviceCategory' },
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'newUsers' },
          { name: 'activeUsers' },
          { name: 'screenPageViews' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
          { name: 'eventsPerSession' },
          { name: 'engagementRate' },
          { name: 'conversions' },
          { name: 'totalRevenue' },
        ],
        limit: 10000,
      });

      // Aggregate by date
      const byDate = new Map<string, {
        sessions: number; users: number; newUsers: number; activeUsers: number;
        pageViews: number; bounceRate: number; sessionDuration: number;
        eventsPerSession: number; engagementRate: number; conversions: number;
        revenue: number; sources: Map<string, number>; countries: Map<string, number>;
        devices: Map<string, number>;
      }>();

      for (const row of response.rows ?? []) {
        const dims = row.dimensionValues ?? [];
        const vals = row.metricValues ?? [];

        const date = dims[0]?.value ?? '';
        const source = dims[1]?.value ?? '';
        const medium = dims[2]?.value ?? '';
        const country = dims[3]?.value ?? '';
        const device = dims[4]?.value ?? '';

        if (!date) continue;

        if (!byDate.has(date)) {
          byDate.set(date, {
            sessions: 0, users: 0, newUsers: 0, activeUsers: 0,
            pageViews: 0, bounceRate: 0, sessionDuration: 0,
            eventsPerSession: 0, engagementRate: 0, conversions: 0,
            revenue: 0, sources: new Map(), countries: new Map(), devices: new Map(),
          });
        }

        const d = byDate.get(date)!;
        d.sessions += parseFloat(vals[0]?.value ?? '0');
        d.users += parseFloat(vals[1]?.value ?? '0');
        d.newUsers += parseFloat(vals[2]?.value ?? '0');
        d.activeUsers += parseFloat(vals[3]?.value ?? '0');
        d.pageViews += parseFloat(vals[4]?.value ?? '0');
        d.bounceRate = parseFloat(vals[5]?.value ?? '0'); // last wins, approximate
        d.sessionDuration += parseFloat(vals[6]?.value ?? '0');
        d.eventsPerSession = parseFloat(vals[7]?.value ?? '0');
        d.engagementRate = parseFloat(vals[8]?.value ?? '0');
        d.conversions += parseFloat(vals[9]?.value ?? '0');
        d.revenue += parseFloat(vals[10]?.value ?? '0');

        if (source) d.sources.set(`${source}/${medium}`, (d.sources.get(`${source}/${medium}`) ?? 0) + parseFloat(vals[0]?.value ?? '0'));
        if (country) d.countries.set(country, (d.countries.get(country) ?? 0) + parseFloat(vals[1]?.value ?? '0'));
        if (device) d.devices.set(device, (d.devices.get(device) ?? 0) + parseFloat(vals[0]?.value ?? '0'));
      }

      // Store aggregated daily metrics
      for (const [date, d] of byDate.entries()) {
        const topSources = [...d.sources.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
        const topCountries = [...d.countries.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
        const deviceBreakdown = [...d.devices.entries()].sort((a, b) => b[1] - a[1]);

        await prisma.googleAnalyticsMetric.upsert({
          where: { propertyId_date: { propertyId, date } },
          create: {
            propertyId,
            date,
            sessions: Math.round(d.sessions),
            users: Math.round(d.users),
            newUsers: Math.round(d.newUsers),
            activeUsers: Math.round(d.activeUsers),
            pageViews: Math.round(d.pageViews),
            screenViews: Math.round(d.pageViews),
            bounceRate: d.bounceRate,
            sessionDuration: d.sessionDuration,
            eventsPerSession: d.eventsPerSession,
            engagementRate: d.engagementRate,
            conversions: Math.round(d.conversions),
            revenue: d.revenue || null,
            source: JSON.stringify(topSources),
            country: JSON.stringify(topCountries),
            deviceCategory: JSON.stringify(deviceBreakdown),
          },
          update: {
            sessions: Math.round(d.sessions),
            users: Math.round(d.users),
            newUsers: Math.round(d.newUsers),
            activeUsers: Math.round(d.activeUsers),
            pageViews: Math.round(d.pageViews),
            bounceRate: d.bounceRate,
            engagementRate: d.engagementRate,
            conversions: Math.round(d.conversions),
            revenue: d.revenue || null,
            source: JSON.stringify(topSources),
            country: JSON.stringify(topCountries),
          },
        });
      }

      // Fetch top pages
      try {
        const [pagesResponse] = await client.runReport({
          property: propertyId,
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
          metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }, { name: 'averageSessionDuration' }],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: 50,
        });

        const topPages = (pagesResponse.rows ?? []).map(row => ({
          path: row.dimensionValues?.[0]?.value ?? '',
          title: row.dimensionValues?.[1]?.value ?? '',
          pageViews: parseInt(row.metricValues?.[0]?.value ?? '0'),
          users: parseInt(row.metricValues?.[1]?.value ?? '0'),
          avgDuration: parseFloat(row.metricValues?.[2]?.value ?? '0'),
        }));

        // Store as metadata on the most recent date in range
        if (topPages.length > 0 && byDate.size > 0) {
          const lastDate = [...byDate.keys()].sort().pop()!;
          await prisma.googleAnalyticsMetric.update({
            where: { propertyId_date: { propertyId, date: lastDate } },
            data: { topPages: JSON.stringify(topPages) },
          });
        }
      } catch (pagesErr) {
        logger.warn('Could not fetch top pages', { error: pagesErr });
      }

    } catch (err) {
      logger.error(`Failed to sync GA4 metrics for ${propertyId}`, { error: err });
      throw err;
    }
  }

  /**
   * Get GA4 metrics summary for a property and date range
   */
  static async getMetricsSummary(propertyId: string, startDate: string, endDate: string) {
    const metrics = await prisma.googleAnalyticsMetric.findMany({
      where: { propertyId, date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'asc' },
    });

    return {
      metrics,
      totals: {
        sessions: metrics.reduce((s, m) => s + (m.sessions ?? 0), 0),
        users: metrics.reduce((s, m) => s + (m.users ?? 0), 0),
        newUsers: metrics.reduce((s, m) => s + (m.newUsers ?? 0), 0),
        pageViews: metrics.reduce((s, m) => s + (m.pageViews ?? 0), 0),
        conversions: metrics.reduce((s, m) => s + (m.conversions ?? 0), 0),
        avgBounceRate: metrics.length
          ? metrics.reduce((s, m) => s + (m.bounceRate ?? 0), 0) / metrics.length
          : null,
        avgEngagementRate: metrics.length
          ? metrics.reduce((s, m) => s + (m.engagementRate ?? 0), 0) / metrics.length
          : null,
      },
    };
  }
}
