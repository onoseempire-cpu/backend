import prisma from '../../config/database';
import { logger } from '../../utils/logger';

interface OverviewData {
  period: { startDate: string; endDate: string; label: string };
  youtube: {
    connected: boolean;
    channels: number;
    subscribers: number;
    views: number;
    viewsGrowth: number | null;
    watchTimeHours: number;
    subscribersGained: number;
    subscribersGainedGrowth: number | null;
    estimatedRevenue: number | null;
    revenueNote: string | null;
  };
  googleAnalytics: {
    connected: boolean;
    properties: number;
    sessions: number;
    sessionsGrowth: number | null;
    activeUsers: number;
  };
  adSense: { connected: boolean };
  searchConsole: { connected: boolean };
  lastSyncAt: string | null;
  reportingNote: string;
}

export class OverviewAnalytics {
  static async getOverview(userId: string, period: string): Promise<OverviewData> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // ── YouTube ──────────────────────────────────────────────────────────────
    const youtubeAccounts = await prisma.connectedAccount.findMany({
      where: { userId, provider: 'YOUTUBE', status: 'active' },
      select: { id: true },
    });

    let youtubeData = {
      connected: youtubeAccounts.length > 0,
      channels: 0,
      subscribers: 0,
      views: 0,
      viewsGrowth: null as number | null,
      watchTimeHours: 0,
      subscribersGained: 0,
      subscribersGainedGrowth: null as number | null,
      estimatedRevenue: null as number | null,
      revenueNote: null as string | null,
    };

    if (youtubeAccounts.length > 0) {
      const accountIds = youtubeAccounts.map(a => a.id);
      const channels = await prisma.youTubeChannel.findMany({
        where: { connectedAccountId: { in: accountIds } },
      });

      const channelIds = channels.map(c => c.channelId);
      const metrics = await prisma.youTubeChannelMetric.findMany({
        where: { channelId: { in: channelIds }, date: { gte: startDate } },
      });

      youtubeData.channels = channels.length;
      youtubeData.subscribers = channels.reduce((sum, c) => sum + Number(c.subscriberCount || 0), 0);
      youtubeData.views = metrics.reduce((sum, m) => sum + (m.views || 0), 0);
      youtubeData.watchTimeHours = Math.round(metrics.reduce((sum, m) => sum + (m.watchTimeMinutes || 0), 0) / 60);
      youtubeData.subscribersGained = metrics.reduce((sum, m) => sum + (m.subscribersGained || 0), 0);
      youtubeData.estimatedRevenue = metrics.some(m => m.estimatedRevenue !== null)
        ? metrics.reduce((sum, m) => sum + (m.estimatedRevenue || 0), 0)
        : null;
      youtubeData.revenueNote = youtubeData.estimatedRevenue === null
        ? 'Revenue data requires monetization permission'
        : null;
    }

    // ── Google Analytics ─────────────────────────────────────────────────────
    const gaAccounts = await prisma.connectedAccount.findMany({
      where: { userId, provider: 'GOOGLE_ANALYTICS', status: 'active' },
      select: { id: true },
    });

    let gaData = {
      connected: gaAccounts.length > 0,
      properties: 0,
      sessions: 0,
      sessionsGrowth: null as number | null,
      activeUsers: 0,
    };

    if (gaAccounts.length > 0) {
      const accountIds = gaAccounts.map(a => a.id);
      const properties = await prisma.googleAnalyticsProperty.findMany({
        where: { connectedAccountId: { in: accountIds } },
      });

      const propIds = properties.map(p => p.propertyId);
      const metrics = await prisma.googleAnalyticsMetric.findMany({
        where: { propertyId: { in: propIds }, date: { gte: startDate } },
      });

      gaData.properties = properties.length;
      gaData.sessions = metrics.reduce((sum, m) => sum + (m.sessions || 0), 0);
      gaData.activeUsers = metrics.reduce((sum, m) => sum + (m.users || 0), 0);
    }

    // ── Other ────────────────────────────────────────────────────────────────
    const adsenseConnected = await prisma.connectedAccount.findFirst({
      where: { userId, provider: 'GOOGLE_ADSENSE', status: 'active' },
    });

    const searchConsoleConnected = await prisma.connectedAccount.findFirst({
      where: { userId, provider: 'GOOGLE_SEARCH_CONSOLE', status: 'active' },
    });

    // Last sync
    const lastSync = await prisma.connectedAccount.findFirst({
      where: { userId, lastSyncAt: { not: null } },
      orderBy: { lastSyncAt: 'desc' },
      select: { lastSyncAt: true },
    });

    return {
      period: {
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        label: period,
      },
      youtube: youtubeData,
      googleAnalytics: gaData,
      adSense: { connected: !!adsenseConnected },
      searchConsole: { connected: !!searchConsoleConnected },
      lastSyncAt: lastSync?.lastSyncAt?.toISOString() ?? null,
      reportingNote: 'YouTube data may have 24-48h delay. GA4 data may have 24h delay.',
    };
  }
}