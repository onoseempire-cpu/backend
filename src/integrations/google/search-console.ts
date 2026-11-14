import { google } from 'googleapis';
import { getAuthenticatedClient } from './oauth';
import prisma from '../../config/database';
import { logger } from '../../utils/logger';

export class SearchConsoleService {
  static async syncSearchAnalytics(connectedAccountId: string, days = 30): Promise<void> {
    const auth = await getAuthenticatedClient(connectedAccountId);
    const searchconsole = google.searchconsole({ version: 'v1', auth });

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    // Get sites
    const { data: sites } = await searchconsole.sites.list();
    for (const site of sites.siteEntry ?? []) {
      if (!site.siteUrl || site.permissionLevel !== 'siteOwner') continue;

      const { data } = await searchconsole.searchanalytics.query({
        siteUrl: site.siteUrl,
        requestBody: {
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          dimensions: ['date', 'query', 'page'],
          rowLimit: 1000,
        },
      });

      // TODO: Store search analytics data
    }
    logger.info('Search Console analytics synced', { connectedAccountId });
  }
}