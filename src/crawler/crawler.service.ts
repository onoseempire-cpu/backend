import prisma from '../config/database';
import { logger } from '../utils/logger';

export type CrawlerJobType = 'sync' | 'discover' | 'update' | 'full_reindex';

interface PauseFlag {
  paused: boolean;
}

const pauseFlags = new Map<string, PauseFlag>();

export class CrawlerService {
  static async startCrawl(
    userId: string,
    jobType: CrawlerJobType,
    sources?: string[]
  ): Promise<string> {
    const job = await prisma.crawlerJob.create({
      data: {
        userId,
        jobType,
        sources: sources ? JSON.stringify(sources) : null,
        status: 'running',
        startedAt: new Date(),
        progressPercent: 0,
        currentStep: 'Starting crawler...',
      },
    });

    logger.info('Crawler job started', { jobId: job.id, userId, jobType });

    // Run in background
    this.runCrawl(job.id, userId, jobType, sources).catch(err => {
      logger.error('Crawl failed', { jobId: job.id, error: err });
    });

    return job.id;
  }

  static async pause(userId: string, jobId: string): Promise<void> {
    const flag = pauseFlags.get(jobId) || { paused: false };
    flag.paused = true;
    pauseFlags.set(jobId, flag);

    await prisma.crawlerJob.update({
      where: { id: jobId },
      data: { status: 'paused' },
    });
  }

  static async resume(userId: string, jobId: string): Promise<void> {
    const flag = pauseFlags.get(jobId) || { paused: false };
    flag.paused = false;
    pauseFlags.set(jobId, flag);

    await prisma.crawlerJob.update({
      where: { id: jobId },
      data: { status: 'running' },
    });
  }

  static async stop(userId: string, jobId: string): Promise<void> {
    const flag = pauseFlags.get(jobId) || { paused: false };
    flag.paused = true;
    pauseFlags.set(jobId, flag);

    await prisma.crawlerJob.update({
      where: { id: jobId },
      data: { status: 'stopped', completedAt: new Date() },
    });
  }

  static async getStatus(userId: string, jobId?: string) {
    if (jobId) {
      return prisma.crawlerJob.findFirst({ where: { id: jobId, userId } });
    }
    return prisma.crawlerJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  private static async runCrawl(jobId: string, userId: string, jobType: CrawlerJobType, sources?: string[]): Promise<void> {
    const logs: string[] = [];
    let itemsProcessed = 0;
    let itemsUpdated = 0;
    let itemsFailed = 0;

    try {
      // Update progress
      await prisma.crawlerJob.update({
        where: { id: jobId },
        data: { progressPercent: 10, currentStep: 'Fetching connected accounts...' },
      });
      logs.push('Fetching connected accounts...');

      // Get connected accounts for this user
      const accounts = await prisma.connectedAccount.findMany({
        where: { userId, status: 'active' },
      });

      if (accounts.length === 0) {
        logs.push('No connected accounts found');
        await prisma.crawlerJob.update({
          where: { id: jobId },
          data: { status: 'completed', completedAt: new Date(), progressPercent: 100, currentStep: 'No accounts to crawl', itemsProcessed, itemsUpdated, itemsFailed, logJson: JSON.stringify(logs) },
        });
        return;
      }

      let totalSteps = accounts.length * 3;
      let currentStep = 10;

      for (const account of accounts) {
        // Check if paused
        const flag = pauseFlags.get(jobId);
        if (flag?.paused) {
          logs.push(`Crawl paused at account ${account.provider}`);
          await prisma.crawlerJob.update({
            where: { id: jobId },
            data: { status: 'paused', currentStep: 'Paused', progressPercent: currentStep, itemsProcessed, itemsUpdated, itemsFailed, logJson: JSON.stringify(logs) },
          });
          return;
        }

        try {
          currentStep += Math.floor(90 / totalSteps);
          await prisma.crawlerJob.update({
            where: { id: jobId },
            data: { progressPercent: currentStep, currentStep: `Syncing ${account.provider}...` },
          });
          logs.push(`Syncing ${account.provider}...`);

          // Sync based on provider
          const { getAuthenticatedClient: _getAuth } = await import('../integrations/google/oauth');
          const { YouTubeDataService } = await import('../integrations/google/youtube-data');
          const { YouTubeAnalyticsService } = await import('../integrations/google/youtube-analytics');
          const { GoogleAnalyticsService } = await import('../integrations/google/google-analytics');

          await _getAuth(account.id); // Ensure credentials are valid before sync

          if (account.provider === 'YOUTUBE' || account.provider === 'youtubeData') {
            await YouTubeDataService.syncChannelInfo(account.id);
            await YouTubeDataService.syncVideos(account.id);
            await YouTubeAnalyticsService.syncChannelMetrics(account.id);
            logs.push(`Synced YouTube data for ${account.displayName || account.id}`);
          } else if (account.provider === 'GOOGLE_ANALYTICS' || account.provider === 'googleAnalytics') {
            await GoogleAnalyticsService.syncProperties(account.id);
            await GoogleAnalyticsService.syncMetrics(account.id);
            logs.push(`Synced Google Analytics data for ${account.displayName || account.id}`);
          }

          itemsProcessed++;
          itemsUpdated++;

        } catch (err) {
          logger.error(`Failed to sync ${account.provider}`, { error: err, accountId: account.id });
          itemsFailed++;
          logs.push(`Failed ${account.provider}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      // Final update
      const status = itemsFailed === accounts.length ? 'failed' : (itemsFailed > 0 ? 'partial' : 'completed');
      await prisma.crawlerJob.update({
        where: { id: jobId },
        data: {
          status,
          completedAt: new Date(),
          progressPercent: 100,
          currentStep: 'Crawl complete',
          itemsProcessed,
          itemsUpdated,
          itemsFailed,
          logJson: JSON.stringify(logs),
        },
      });

    } catch (err) {
      logger.error('Crawler job failed', { jobId, error: err });
      await prisma.crawlerJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          currentStep: 'Failed',
          itemsFailed: itemsFailed + 1,
          logJson: JSON.stringify(logs),
        },
      });
    } finally {
      pauseFlags.delete(jobId);
    }
  }
}