import * as cron from 'node-cron';
import { CrawlerService } from './crawler.service';
import { logger } from '../utils/logger';

export class CrawlerScheduler {
  private static crawlTask: cron.ScheduledTask | null = null;

  static start(): void {
    if (this.crawlTask) return;

    // Run every hour
    this.crawlTask = cron.schedule('0 * * * *', async () => {
      logger.info('Starting scheduled crawler job');
      try {
        // For each active connected account, run sync
        const accounts = await (await import('../config/database')).default.connectedAccount.findMany({
          where: { status: 'active' },
        });

        for (const account of accounts) {
          await CrawlerService.startCrawl(account.userId, 'sync', [account.provider.toLowerCase()]);
        }
      } catch (err) {
        logger.error('Scheduled crawler failed', { error: err });
      }
    });

    logger.info('Crawler scheduler started');
  }

  static stop(): void {
    if (this.crawlTask) {
      this.crawlTask.stop();
      this.crawlTask = null;
      logger.info('Crawler scheduler stopped');
    }
  }
}