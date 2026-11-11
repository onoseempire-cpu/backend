import prisma from '../config/database';
import { logger } from '../utils/logger';
import { getSocketServer } from '../sockets/socket.server';
import { YouTubeDataService } from '../integrations/google/youtube-data';
import { YouTubeAnalyticsService } from '../integrations/google/youtube-analytics';
import { GoogleAnalyticsService } from '../integrations/google/google-analytics';
import { NotificationService } from '../services/notification.service';
import { getDateRange } from '../utils/date';

export type CrawlerJobType = 'discover' | 'sync' | 'update' | 'historical';

const pauseFlags = new Map<string, boolean>();

export class CrawlerService {
  static async startCrawl(userId: string, jobType: CrawlerJobType = 'sync', sources?: string[]): Promise<string> {
    const existing = await prisma.crawlerJob.findFirst({ where: { userId, status: { in: ['running', 'paused'] } } });
    if (existing) return existing.id;

    const job = await prisma.crawlerJob.create({
      data: { userId, jobType, status: 'running', sources: sources ? JSON.stringify(sources) : null, startedAt: new Date(), progressPercent: 0, currentStep: 'Starting crawler...' },
    });

    logger.info('Crawler started', { jobId: job.id, userId, jobType });
    this.emitEvent(userId, 'crawler.started', { jobId: job.id });
    this.runCrawl(userId, job.id, jobType, sources).catch(err => logger.error('Crawler failed', { jobId: job.id, error: err }));
    return job.id;
  }

  private static async runCrawl(userId: string, jobId: string, jobType: CrawlerJobType, sources?: string[]) {
    const logs: string[] = [];
    const addLog = (m: string) => logs.push(`[${new Date().toISOString()}] ${m}`);
    let itemsProcessed = 0, itemsUpdated = 0, itemsFailed = 0;

    try {
      const accounts = await prisma.connectedAccount.findMany({ where: { userId, status: 'active' } });
      const targetSources = sources ?? accounts.map(a => a.provider);
      const relevant = accounts.filter(a => targetSources.includes(a.provider));

      for (let i = 0; i < relevant.length; i++) {
        const account = relevant[i];
        const pct = Math.round((i / (relevant.length || 1)) * 90);

        if (pauseFlags.get(jobId)) {
          await prisma.crawlerJob.update({ where: { id: jobId }, data: { status: 'paused', pausedAt: new Date() } });
          this.emitEvent(userId, 'crawler.progress', { jobId, progress: pct, step: 'Paused' });
          addLog('Crawler paused by user');
          while (pauseFlags.get(jobId)) await new Promise(r => setTimeout(r, 1000));
          await prisma.crawlerJob.update({ where: { id: jobId }, data: { status: 'running' } });
        }

        try {
          addLog(`Crawling ${account.provider}`);
          await this.updateJobProgress(jobId, pct, `Crawling ${account.provider}...`);
          this.emitEvent(userId, 'crawler.progress', { jobId, progress: pct, step: `Crawling ${account.provider}...` });

          if (account.provider === 'youtube-data') {
            await YouTubeDataService.syncChannelInfo(account.id);
            const count = await YouTubeDataService.syncVideos(account.id, 100);
            itemsProcessed += count; itemsUpdated += count;
          }
          if (account.provider === 'youtube-analytics') {
            const { startDate, endDate } = getDateRange('7d');
            await YouTubeAnalyticsService.syncChannelMetrics(account.id, startDate, endDate);
            itemsProcessed += 7; itemsUpdated += 7;
          }
          if (account.provider === 'google-analytics') {
            await GoogleAnalyticsService.listProperties(account.id);
            const props = await prisma.googleAnalyticsProperty.findMany({ where: { connectedAccountId: account.id } });
            for (const prop of props) {
              const { startDate, endDate } = getDateRange('7d');
              await GoogleAnalyticsService.syncPropertyMetrics(account.id, prop.propertyId, startDate, endDate);
              itemsProcessed += 7; itemsUpdated += 7;
            }
          }
          await prisma.connectedAccount.update({ where: { id: account.id }, data: { lastSyncAt: new Date(), status: 'active' } });
          addLog(`✅ ${account.provider}: success`);
        } catch (err) {
          itemsFailed++;
          addLog(`ERROR: ${(err as Error).message}`);
        }
      }

      await prisma.crawlerJob.update({
        where: { id: jobId },
        data: { status: 'completed', completedAt: new Date(), progressPercent: 100, currentStep: 'Crawl complete', itemsProcessed, itemsUpdated, itemsFailed, logJson: JSON.stringify(logs) },
      });

      this.emitEvent(userId, 'crawler.completed', { jobId, itemsProcessed, itemsUpdated });
      this.emitEvent(userId, 'analytics.updated', { timestamp: new Date().toISOString() });
      await NotificationService.create(userId, 'sync', 'Crawler Complete', `Crawled ${itemsProcessed} items, updated ${itemsUpdated}.`);
    } catch (err) {
      await prisma.crawlerJob.update({ where: { id: jobId }, data: { status: 'failed', completedAt: new Date(), lastError: (err as Error).message, logJson: JSON.stringify(logs) } });
      this.emitEvent(userId, 'crawler.failed', { jobId, error: (err as Error).message });
    } finally {
      pauseFlags.delete(jobId);
    }
  }

  static async pause(userId: string, jobId: string): Promise<void> {
    const job = await prisma.crawlerJob.findFirst({ where: { id: jobId, userId, status: 'running' } });
    if (!job) throw new Error('Job not found or not running');
    pauseFlags.set(jobId, true);
  }

  static async resume(userId: string, jobId: string): Promise<void> { pauseFlags.set(jobId, false); }

  static async stop(userId: string, jobId: string): Promise<void> {
    await prisma.crawlerJob.update({ where: { id: jobId }, data: { status: 'cancelled', completedAt: new Date() } });
    pauseFlags.delete(jobId);
  }

  static async getStatus(userId: string, jobId?: string) {
    if (jobId) return prisma.crawlerJob.findFirst({ where: { id: jobId, userId } });
    return prisma.crawlerJob.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  private static async updateJobProgress(jobId: string, pct: number, step: string) {
    await prisma.crawlerJob.update({ where: { id: jobId }, data: { progressPercent: pct, currentStep: step } });
  }

  private static emitEvent(userId: string, event: string, data: Record<string, unknown>) {
    try { const io = getSocketServer(); io.to(`user:${userId}`).emit(event, { ...data, timestamp: new Date().toISOString() }); }
    catch { /* socket not ready */ }
  }
}
