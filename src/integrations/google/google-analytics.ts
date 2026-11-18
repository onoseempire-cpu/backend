import { google } from 'googleapis';
import { getAuthenticatedClient } from './oauth';
import prisma from '../../config/database';
import { logger } from '../../utils/logger';

export class GoogleAnalyticsService {
  static async syncProperties(connectedAccountId: string): Promise<void> {
    const auth = await getAuthenticatedClient(connectedAccountId);
    const analytics = google.analyticsadmin({ version: 'v1alpha', auth });

    const { data } = await analytics.accountSummaries.list();
    for (const account of data.accountSummaries ?? []) {
      for (const prop of account.propertySummaries ?? []) {
        if (!prop.property) continue;
        const propId = prop.property.split('/').pop()!;
        await prisma.googleAnalyticsProperty.upsert({
          where: { propertyId: propId },
          create: {
            connectedAccountId,
            propertyId: propId,
            accountId: account.account?.split('/').pop() ?? null,
            name: prop.displayName ?? null,
            displayName: prop.displayName ?? null,
          },
          update: {
            displayName: prop.displayName ?? undefined,
          },
        });
      }
    }
    logger.info('GA properties synced', { connectedAccountId });
  }

  static async syncMetrics(connectedAccountId: string, days = 30): Promise<void> {
    const auth = await getAuthenticatedClient(connectedAccountId);
    const analyticsData = google.analyticsdata({ version: 'v1beta', auth });

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const properties = await prisma.googleAnalyticsProperty.findMany({
      where: { connectedAccountId },
    });

    for (const prop of properties) {
      const { data: report } = await analyticsData.properties.runReport({
        property: `properties/${prop.propertyId}`,
        requestBody: {
          dateRanges: [{ startDate: formatDate(startDate), endDate: formatDate(endDate) }],
          dimensions: [{ name: 'date' }],
          metrics: [
            { name: 'sessions' },
            { name: 'totalUsers' },
            { name: 'newUsers' },
            { name: 'screenPageViews' },
            { name: 'bounceRate' },
            { name: 'engagementRate' },
            { name: 'conversions' },
          ],
        },
      });

      for (const row of report.rows ?? []) {
        const rawDate = row.dimensionValues?.[0]?.value ?? '';
        const date = /^\\d{8}$/.test(rawDate)
          ? new Date(`${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}T00:00:00.000Z`)
          : new Date(rawDate);
        if (isNaN(date.getTime())) continue;

        await prisma.googleAnalyticsMetric.upsert({
          where: { propertyId_date: { propertyId: prop.propertyId, date } },
          create: {
            propertyId: prop.propertyId,
            date,
            sessions: (row.metricValues?.[0]?.value == null ? null : Number(row.metricValues[0].value)),
            users: (row.metricValues?.[1]?.value == null ? null : Number(row.metricValues[1].value)),
            newUsers: (row.metricValues?.[2]?.value == null ? null : Number(row.metricValues[2].value)),
            pageViews: (row.metricValues?.[3]?.value == null ? null : Number(row.metricValues[3].value)),
            bounceRate: (row.metricValues?.[4]?.value == null ? null : Number(row.metricValues[4].value)),
            engagementRate: (row.metricValues?.[5]?.value == null ? null : Number(row.metricValues[5].value)),
            conversions: (row.metricValues?.[6]?.value == null ? null : Number(row.metricValues[6].value)),
          },
          update: {
            sessions: (row.metricValues?.[0]?.value == null ? null : Number(row.metricValues[0].value)),
            users: (row.metricValues?.[1]?.value == null ? null : Number(row.metricValues[1].value)),
            newUsers: (row.metricValues?.[2]?.value == null ? null : Number(row.metricValues[2].value)),
            pageViews: (row.metricValues?.[3]?.value == null ? null : Number(row.metricValues[3].value)),
            bounceRate: (row.metricValues?.[4]?.value == null ? null : Number(row.metricValues[4].value)),
            engagementRate: (row.metricValues?.[5]?.value == null ? null : Number(row.metricValues[5].value)),
            conversions: (row.metricValues?.[6]?.value == null ? null : Number(row.metricValues[6].value)),
          },
        });
      }
    }
    logger.info('GA metrics synced', { connectedAccountId });
  }
}