import prisma from '../config/database';
import { logger } from '../utils/logger';
import { EncryptionService } from '../services/encryption.service';

interface IndexingProgress {
  jobId: string;
  progress: number;
  step: string;
}

export class IndexerService {
  private static progressCallbacks = new Map<string, (p: IndexingProgress) => void>();

  static onProgress(jobId: string, callback: (p: IndexingProgress) => void) {
    this.progressCallbacks.set(jobId, callback);
  }

  private static emitProgress(jobId: string, progress: number, step: string) {
    const cb = this.progressCallbacks.get(jobId);
    if (cb) cb({ jobId, progress, step });
  }

  static async startIndexing(
    userId: string,
    jobType: 'manual' | 'incremental' | 'full_reindex',
    sources?: string[]
  ): Promise<string> {
    const job = await prisma.indexingJob.create({
      data: {
        userId,
        type: jobType,
        jobType,
        status: 'running',
        startedAt: new Date(),
        progress: 0,
        progressPercent: 0,
        currentStep: 'Starting indexing...',
      },
    });

    logger.info('Indexing job started', { jobId: job.id, userId, jobType });

    this.runIndexing(job.id, userId, jobType, sources).catch(err => {
      logger.error('Indexing failed', { jobId: job.id, error: err });
    });

    return job.id;
  }

  static async getStatus(userId: string, jobId?: string) {
    if (jobId) {
      return prisma.indexingJob.findFirst({ where: { id: jobId, userId } });
    }
    return prisma.indexingJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  static async getHistory(userId: string, limit = 20) {
    return prisma.indexingJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, jobType: true, status: true, progressPercent: true, currentStep: true, processed: true, failed: true, startedAt: true, completedAt: true, errorMessage: true, createdAt: true },
    });
  }

  private static async runIndexing(jobId: string, userId: string, jobType: string, sources?: string[]): Promise<void> {
    const logs: string[] = [];
    let processed = 0;
    let failed = 0;

    try {
      this.emitProgress(jobId, 5, 'Fetching connected accounts...');
      logs.push('Fetching connected accounts...');

      // Get connected accounts for this user
      const accounts = await prisma.connectedAccount.findMany({
        where: { userId, status: 'active' },
      });

      if (accounts.length === 0) {
        logs.push('No connected accounts found');
        await this.completeJob(jobId, 'completed', 100, 'No accounts to index', 0, 0, logs);
        return;
      }

      let currentProgress = 5;
      const stepIncrement = 90 / accounts.length;

      for (const account of accounts) {
        this.emitProgress(jobId, Math.floor(currentProgress), `Indexing ${account.provider}...`);
        logs.push(`Indexing ${account.provider}...`);

        try {
          const { getAuthenticatedClient } = await import('../integrations/google/oauth');
          const { YouTubeDataService } = await import('../integrations/google/youtube-data');
          const { YouTubeAnalyticsService } = await import('../integrations/google/youtube-analytics');
          const { GoogleAnalyticsService } = await import('../integrations/google/google-analytics');

          const client = await getAuthenticatedClient(account.id);

          if (account.provider === 'YOUTUBE' || account.provider === 'youtubeData') {
            await YouTubeDataService.syncChannelInfo(account.id);
            await YouTubeDataService.syncVideos(account.id);
            await YouTubeAnalyticsService.syncChannelMetrics(account.id);
            logs.push(`Indexed YouTube data for ${account.displayName || account.id}`);
          } else if (account.provider === 'GOOGLE_ANALYTICS' || account.provider === 'googleAnalytics') {
            await GoogleAnalyticsService.syncProperties(account.id);
            await GoogleAnalyticsService.syncMetrics(account.id);
            logs.push(`Indexed Google Analytics data for ${account.displayName || account.id}`);
          }

          processed++;
        } catch (err) {
          logger.error(`Failed to index ${account.provider}`, { error: err, accountId: account.id });
          failed++;
          logs.push(`Failed ${account.provider}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }

        currentProgress += stepIncrement;
        this.emitProgress(jobId, Math.floor(currentProgress), `Processed ${processed}/${accounts.length} accounts`);
        await this.updateJobProgress(jobId, Math.floor(currentProgress), `Processed ${processed}/${accounts.length} accounts`);
      }

      const status = failed === accounts.length ? 'failed' : (failed > 0 ? 'partial' : 'completed');
      await this.completeJob(jobId, status, 100, 'Indexing complete', processed, failed, logs);

    } catch (err) {
      logger.error('Indexing job failed', { jobId, error: err });
      await this.completeJob(jobId, 'failed', 100, 'Indexing failed', processed, failed + 1, [...logs, `Error: ${err instanceof Error ? err.message : 'Unknown error'}`]);
    }
  }

  private static async updateJobProgress(jobId: string, progress: number, step: string) {
    await prisma.indexingJob.update({
      where: { id: jobId },
      data: { progressPercent: progress, currentStep: step, progress },
    });
  }

  private static async completeJob(
    jobId: string,
    status: string,
    progress: number,
    step: string,
    processed: number,
    failed: number,
    logs: string[]
  ) {
    await prisma.indexingJob.update({
      where: { id: jobId },
      data: {
        status,
        completedAt: new Date(),
        progressPercent: progress,
        progress,
        currentStep: step,
        processed,
        failed,
        errorMessage: logs.filter(l => l.startsWith('Failed')).join('; ') || null,
        logJson: JSON.stringify(logs),
      },
    });
  }
}