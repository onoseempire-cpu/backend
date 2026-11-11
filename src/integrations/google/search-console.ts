import { google } from 'googleapis';
import { getAuthenticatedClient } from './oauth';
import { logger } from '../../utils/logger';

export class SearchConsoleService {
  static async listSites(connectedAccountId: string) {
    const auth = await getAuthenticatedClient(connectedAccountId);
    const sc = google.searchconsole({ version: 'v1', auth });
    const { data } = await sc.sites.list();
    return data.siteEntry ?? [];
  }

  static async getSearchAnalytics(
    connectedAccountId: string,
    siteUrl: string,
    startDate: string,
    endDate: string
  ) {
    const auth = await getAuthenticatedClient(connectedAccountId);
    const sc = google.searchconsole({ version: 'v1', auth });

    const { data } = await sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate, endDate,
        dimensions: ['date', 'query', 'page', 'country', 'device'],
        rowLimit: 1000,
        aggregationType: 'byPage',
      },
    });

    logger.info('Search Console data fetched', { siteUrl, startDate, endDate });
    return data.rows ?? [];
  }

  static async getTopPages(connectedAccountId: string, siteUrl: string, startDate: string, endDate: string) {
    const auth = await getAuthenticatedClient(connectedAccountId);
    const sc = google.searchconsole({ version: 'v1', auth });
    const { data } = await sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate, endDate,
        dimensions: ['page'],
        rowLimit: 50,
        aggregationType: 'byPage',
      },
    });
    return (data.rows ?? []).map(r => ({
      page: r.keys?.[0] ?? '',
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: r.ctr ?? 0,
      position: r.position ?? 0,
    }));
  }

  static async getTopQueries(connectedAccountId: string, siteUrl: string, startDate: string, endDate: string) {
    const auth = await getAuthenticatedClient(connectedAccountId);
    const sc = google.searchconsole({ version: 'v1', auth });
    const { data } = await sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate, endDate,
        dimensions: ['query'],
        rowLimit: 50,
      },
    });
    return (data.rows ?? []).map(r => ({
      query: r.keys?.[0] ?? '',
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: r.ctr ?? 0,
      position: r.position ?? 0,
    }));
  }
}
