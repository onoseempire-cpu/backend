import * as cron from 'node-cron';
import { IndexerService } from './indexer.service';
import { logger } from '../utils/logger';

export class IndexerScheduler {
  private static scheduledTask: cron.ScheduledTask | null = null;
  private static incrementalTask: cron.ScheduledTask | null = null;

  static start(): void {
    if (this.scheduledTask) return;

    // Full reindex daily at 2 AM
    this.scheduledTask = cron.schedule('0 2 * * *', async () => {
      logger.info('Starting scheduled full reindex');
      try {
        const accounts = await (await import('../config/database')).default.connectedAccount.findMany({
          where: { status: 'active' },
        });

        for (const account of accounts) {
          await IndexerService.startIndexing(account.userId, 'full_reindex', [account.provider.toLowerCase()]);
        }
      } catch (err) {
        logger.error('Scheduled full reindex failed', { error: err });
      }
    });

    // Incremental index every hour
    this.incrementalTask = cron.schedule('0 * * * *', async () => {
      logger.info('Starting incremental index');
      try {
        const accounts = await (await import('../config/database')).default.connectedAccount.findMany({
          where: { status: 'active' },
        });

        for (const account of accounts) {
          await IndexerService.startIndexing(account.userId, 'incremental', [account.provider.toLowerCase()]);
        }
      } catch (err) {
        logger.error('Incremental index failed', { error: err });
      }
    });

    logger.info('Indexer schedulers started');
  }

  static stop(): void {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask = null;
    }
    if (this.incrementalTask) {
      this.incrementalTask.stop();
      this.incrementalTask = null;
    }
    logger.info('Indexer schedulers stopped');
  }
}