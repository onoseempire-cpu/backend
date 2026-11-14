import { google } from 'googleapis';
import { logger } from '../../utils/logger';

export class AdSenseService {
  static async syncEarnings(connectedAccountId: string, days = 30): Promise<void> {
    const auth = await (await import('./oauth')).getAuthenticatedClient(connectedAccountId);
    const adsense = google.adsense({ version: 'v2', auth });

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    try {
      const response = await adsense.accounts.reports.generate({
        account: 'accounts/pub-XXXXXXXXXXXXXXXX', // TODO: Get from account
        dateRange: {
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
        },
        metrics: ['EARNINGS', 'PAGE_VIEWS', 'CLICKS', 'CTR', 'RPM'],
        dimensions: ['DATE'],
      });

      // TODO: Store earnings in database
      logger.info('AdSense earnings synced', { connectedAccountId });
    } catch (err) {
      logger.error('AdSense sync failed', { error: err, connectedAccountId });
      throw err;
    }
  }
}
