import cron from 'node-cron';
import { CrawlerService } from './crawler.service';
import prisma from '../config/database';
import { logger } from '../utils/logger';

export class CrawlerScheduler {
  private static crawlTask: cron.ScheduledTask | null = null;

  static start() {
    // Light sync every 2 hours
    this.crawlTask = cron.schedule('0 */2 * * *', async () => {
      logger.info('Scheduled crawler triggered');
      await this.runForAllUsers();
    });
    logger.info('Crawler scheduler started (every 2 hours)');
  }

  static stop() {
    this.crawlTask?.stop();
    logger.info('Crawler scheduler stopped');
  }

  private static async runForAllUsers() {
    try {
      const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true } });
      for (const user of users) {
        const count = await prisma.connectedAccount.count({ where: { userId: user.id, status: 'active' } });
        if (count > 0) await CrawlerService.startCrawl(user.id, 'sync');
      }
    } catch (err) {
      logger.error('Scheduled crawl failed', { error: err });
    }
  }
}
