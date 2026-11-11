import { google } from 'googleapis';
import { getAuthenticatedClient } from './oauth';
import { logger } from '../../utils/logger';

export class AdSenseService {
  static async getAccountInfo(connectedAccountId: string) {
    const auth = await getAuthenticatedClient(connectedAccountId);
    const adsense = google.adsense({ version: 'v2', auth });
    const { data } = await adsense.accounts.list();
    return data.accounts ?? [];
  }

  static async getReportData(
    connectedAccountId: string,
    accountId: string,
    startDate: string,
    endDate: string
  ) {
    const auth = await getAuthenticatedClient(connectedAccountId);
    const adsense = google.adsense({ version: 'v2', auth });

    const { data } = await adsense.accounts.reports.generate({
      account: accountId,
      'dateRange': 'CUSTOM',
      'startDate.year': parseInt(startDate.split('-')[0]),
      'startDate.month': parseInt(startDate.split('-')[1]),
      'startDate.day': parseInt(startDate.split('-')[2]),
      'endDate.year': parseInt(endDate.split('-')[0]),
      'endDate.month': parseInt(endDate.split('-')[1]),
      'endDate.day': parseInt(endDate.split('-')[2]),
      metrics: [
        'PAGE_VIEWS', 'AD_REQUESTS', 'MATCHED_AD_REQUESTS',
        'TOTAL_IMPRESSIONS', 'CLICKS', 'PAGE_VIEWS_CTR',
        'PAGE_VIEWS_RPM', 'TOTAL_EARNINGS', 'COST_PER_CLICK',
      ],
      dimensions: ['DATE'],
    });

    logger.info('AdSense report fetched', { connectedAccountId, startDate, endDate });
    return data;
  }
}
