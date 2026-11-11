import prisma from '../config/database';
import { logger } from '../utils/logger';
import { getSocketServer } from '../sockets/socket.server';
import { YouTubeDataService } from '../integrations/google/youtube-data';
import { YouTubeAnalyticsService } from '../integrations/google/youtube-analytics';
import { GoogleAnalyticsService } from '../integrations/google/google-analytics';
import { NotificationService } from '../services/notification.service';
import { getDateRange } from '../utils/date';

export type IndexerJobType = 'manual' | 'scheduled' | 'incremental' | 'full-reindex';

export class IndexerService {
  static async startIndexing(
    userId: string,
    jobType: IndexerJobType = 'manual',
    sources?: string[]
  ): Promise<string> {
    const running = await prisma.indexingJob.findFirst({ where: { userId, status: 'running' } });
    if (running) return running.id;

    const job = await prisma.indexingJob.create({
      data: {
        userId, jobType, status: 'running',
        sources: sources ? JSON.stringify(sources) : null,
        startedAt: new Date(), progressPercent: 0,
        currentStep: 'Discovering connected accounts...',
      },
    });

    logger.info('Indexing job started', { jobId: job.id, userId, jobType });
    this.emitProgress(userId, job.id, 0, 'Discovering accounts...', 'indexing.started');

    this.runIndexing(userId, job.id, sources).catch(err => {
      logger.error('Indexing job failed', { jobId: job.id, error: err });
    });

    return job.id;
  }

  private static async runIndexing(userId: string, jobId: string, sources?: string[]): Promise<void> {
    let recordsProcessed = 0;
    let recordsFailed = 0;
    const logs: string[] = [];
    const addLog = (msg: string) => { logs.push(`[${new Date().toISOString()}] ${msg}`); };

    try {
      const accounts = await prisma.connectedAccount.findMany({ where: { userId, status: 'active' } });
      const targetSources = sources ?? ['youtube-data', 'youtube-analytics', 'google-analytics'];
      const relevantAccounts = accounts.filter(a => targetSources.includes(a.provider));
      const total = relevantAccounts.length;
      let done = 0;

      for (const account of relevantAccounts) {
        try {
          addLog(`Processing ${account.provider} account: ${account.email ?? account.providerAccountId}`);
          await this.updateProgress(jobId, Math.round((done / (total || 1)) * 85), `Syncing ${account.provider}...`);
          this.emitProgress(userId, jobId, Math.round((done / (total || 1)) * 85), `Syncing ${account.provider}...`);

          if (account.provider === 'youtube-data') {
            await YouTubeDataService.syncChannelInfo(account.id);
            const videosCount = await YouTubeDataService.syncVideos(account.id, 200);
            recordsProcessed += videosCount + 1;
            addLog(`YouTube Data: synced channels + ${videosCount} videos`);
          }

          if (account.provider === 'youtube-analytics') {
            const { startDate, endDate } = getDateRange('90d');
            await YouTubeAnalyticsService.syncChannelMetrics(account.id, startDate, endDate);
            recordsProcessed += 90;
            addLog('YouTube Analytics: synced 90 days of metrics');
          }

          if (account.provider === 'google-analytics') {
            await GoogleAnalyticsService.listProperties(account.id);
            const props = await prisma.googleAnalyticsProperty.findMany({ where: { connectedAccountId: account.id } });
            for (const prop of props) {
              const { startDate, endDate } = getDateRange('90d');
              await GoogleAnalyticsService.syncPropertyMetrics(account.id, prop.propertyId, startDate, endDate);
              recordsProcessed += 90;
            }
            addLog(`Google Analytics: synced ${props.length} properties`);
          }

          await prisma.connectedAccount.update({
            where: { id: account.id },
            data: { lastSyncAt: new Date(), status: 'active' },
          });
          done++;
        } catch (err) {
          recordsFailed++;
          const msg = `Failed to index ${account.provider}: ${(err as Error).message}`;
          addLog(`ERROR: ${msg}`);
          logger.error(msg, { accountId: account.id });
          await prisma.connectedAccount.update({
            where: { id: account.id },
            data: { status: 'error', errorMessage: (err as Error).message },
          });
        }
      }

      await prisma.indexingJob.update({
        where: { id: jobId },
        data: {
          status: 'completed', completedAt: new Date(),
          progressPercent: 100, currentStep: 'Indexing complete',
          recordsProcessed, recordsFailed, logJson: JSON.stringify(logs),
        },
      });

      this.emitProgress(userId, jobId, 100, 'Complete', 'indexing.completed');
      await NotificationService.create(userId, 'success', 'Indexing Complete',
        `Processed ${recordsProcessed} records across ${relevantAccounts.length} accounts.`);

    } catch (err) {
      await prisma.indexingJob.update({
        where: { id: jobId },
        data: { status: 'failed', completedAt: new Date(), errorMessage: (err as Error).message, logJson: JSON.stringify(logs) },
      });
      this.emitProgress(userId, jobId, 0, 'Failed', 'indexing.failed');
    }
  }

  static async getStatus(userId: string, jobId?: string) {
    if (jobId) return prisma.indexingJob.findFirst({ where: { id: jobId, userId } });
    return prisma.indexingJob.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  static async getHistory(userId: string, limit = 20) {
    return prisma.indexingJob.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit });
  }

  private static async updateProgress(jobId: string, pct: number, step: string) {
    await prisma.indexingJob.update({ where: { id: jobId }, data: { progressPercent: pct, currentStep: step } });
  }

  private static emitProgress(userId: string, jobId: string, progress: number, step: string, event = 'indexing.progress') {
    try {
      const io = getSocketServer();
      io.to(`user:${userId}`).emit(event, { jobId, progress, step, timestamp: new Date().toISOString() });
    } catch { /* socket not ready */ }
  }
}
