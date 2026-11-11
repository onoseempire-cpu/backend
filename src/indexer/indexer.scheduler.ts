import cron from 'node-cron';
import { IndexerService } from './indexer.service';
import prisma from '../config/database';
import { logger } from '../utils/logger';

export class IndexerScheduler {
  private static scheduledTask: cron.ScheduledTask | null = null;
  private static incrementalTask: cron.ScheduledTask | null = null;

  static start() {
    // Full re-index every day at 3 AM
    this.scheduledTask = cron.schedule('0 3 * * *', async () => {
      logger.info('Scheduled daily indexing triggered');
      await this.runForAllUsers('scheduled');
    });

    // Incremental sync every 6 hours
    this.incrementalTask = cron.schedule('0 */6 * * *', async () => {
      logger.info('Incremental indexing triggered');
      await this.runForAllUsers('incremental');
    });

    logger.info('Indexer scheduler started (daily 03:00 + incremental every 6h)');
  }

  static stop() {
    this.scheduledTask?.stop();
    this.incrementalTask?.stop();
    logger.info('Indexer scheduler stopped');
  }

  private static async runForAllUsers(jobType: 'scheduled' | 'incremental') {
    try {
      const activeUsers = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      for (const user of activeUsers) {
        const hasAccounts = await prisma.connectedAccount.count({
          where: { userId: user.id, status: 'active' },
        });
        if (hasAccounts > 0) {
          await IndexerService.startIndexing(user.id, jobType);
        }
      }
    } catch (err) {
      logger.error('Scheduled indexing failed', { error: err });
    }
  }
}
