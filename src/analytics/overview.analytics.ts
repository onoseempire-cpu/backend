import prisma from '../config/database';
import { getDateRange, getPreviousPeriod } from '../utils/date';
import { YouTubeAnalyticsService } from '../integrations/google/youtube-analytics';
import { GoogleAnalyticsService } from '../integrations/google/google-analytics';

export class OverviewAnalytics {
  static async getOverview(userId: string, period = '30d') {
    const { startDate, endDate } = getDateRange(period as Parameters<typeof getDateRange>[0]);
    const { startDate: prevStart, endDate: prevEnd } = getPreviousPeriod(startDate, endDate);

    const accounts = await prisma.connectedAccount.findMany({
      where: { userId, status: 'active' },
      include: { youtubeChannels: true, gaProperties: true },
    });

    const ytAccounts = accounts.filter(a => a.provider === 'youtube-data');
    const gaAccounts = accounts.filter(a => a.provider === 'google-analytics');

    // YouTube totals
    const channels = await prisma.youTubeChannel.findMany({
      where: { connectedAccountId: { in: ytAccounts.map(a => a.id) } },
    });

    const channelIds = channels.map(c => c.channelId);
    const ytMetrics = await prisma.youTubeChannelMetric.findMany({
      where: { channelId: { in: channelIds }, date: { gte: startDate, lte: endDate } },
    });
    const ytPrevMetrics = await prisma.youTubeChannelMetric.findMany({
      where: { channelId: { in: channelIds }, date: { gte: prevStart, lte: prevEnd } },
    });

    const ytSum = (key: keyof typeof ytMetrics[0]) => ytMetrics.reduce((s, m) => s + ((m[key] as number | null) ?? 0), 0);
    const ytPrevSum = (key: keyof typeof ytPrevMetrics[0]) => ytPrevMetrics.reduce((s, m) => s + ((m[key] as number | null) ?? 0), 0);

    const totalViews = ytSum('views');
    const prevViews = ytPrevSum('views');
    const totalSubs = channels.reduce((s, c) => s + (c.subscriberCount ?? 0), 0);
    const totalWatchMin = ytSum('estimatedMinutesWatched');
    const hasRevenue = ytMetrics.some(m => m.estimatedRevenue !== null);
    const totalRevenue = hasRevenue ? ytSum('estimatedRevenue') : null;
    const subsGained = ytSum('subscribersGained');
    const prevSubsGained = ytPrevSum('subscribersGained');

    // GA totals
    const gaProperties = await prisma.googleAnalyticsProperty.findMany({
      where: { connectedAccountId: { in: gaAccounts.map(a => a.id) } },
    });
    const gaMetrics = await prisma.googleAnalyticsMetric.findMany({
      where: { propertyId: { in: gaProperties.map(p => p.propertyId) }, date: { gte: startDate, lte: endDate } },
    });
    const gaPrevMetrics = await prisma.googleAnalyticsMetric.findMany({
      where: { propertyId: { in: gaProperties.map(p => p.propertyId) }, date: { gte: prevStart, lte: prevEnd } },
    });
    const gaSum = (key: keyof typeof gaMetrics[0]) => gaMetrics.reduce((s, m) => s + ((m[key] as number | null) ?? 0), 0);
    const gaPrevSum = (key: keyof typeof gaPrevMetrics[0]) => gaPrevMetrics.reduce((s, m) => s + ((m[key] as number | null) ?? 0), 0);

    const totalSessions = gaSum('sessions');
    const prevSessions = gaPrevSum('sessions');
    const totalGaUsers = gaSum('activeUsers');

    const growthPct = (curr: number, prev: number) =>
      prev === 0 ? null : Math.round(((curr - prev) / prev) * 1000) / 10;

    return {
      period: { startDate, endDate, label: period },
      youtube: {
        connected: ytAccounts.length > 0,
        channels: channels.length,
        subscribers: totalSubs,
        views: totalViews,
        viewsGrowth: growthPct(totalViews, prevViews),
        watchTimeHours: Math.round(totalWatchMin / 60),
        subscribersGained: subsGained,
        subscribersGainedGrowth: growthPct(subsGained, prevSubsGained),
        estimatedRevenue: totalRevenue,
        revenueNote: hasRevenue ? 'Estimated revenue. Finalized in YouTube Studio.' : null,
      },
      googleAnalytics: {
        connected: gaAccounts.length > 0,
        properties: gaProperties.length,
        sessions: totalSessions,
        sessionsGrowth: growthPct(totalSessions, prevSessions),
        activeUsers: totalGaUsers,
      },
      adSense: { connected: accounts.some(a => a.provider === 'adsense') },
      searchConsole: { connected: accounts.some(a => a.provider === 'search-console') },
      lastSyncAt: accounts.reduce<string | null>((latest, a) => {
        if (!a.lastSyncAt) return latest;
        const t = a.lastSyncAt.toISOString();
        return !latest || t > latest ? t : latest;
      }, null),
      reportingNote: 'Analytics data may be delayed up to 48 hours by Google reporting systems.',
    };
  }
}
