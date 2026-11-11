import prisma from '../../config/database';
import { getDateRange, getPreviousPeriod } from '../../utils/date';
import type { ParsedQuery } from './query-parser';

export interface QueryResult {
  found: boolean;
  source: string;
  period: { startDate: string; endDate: string };
  value?: number | null;
  unit?: string;
  rows?: Record<string, unknown>[];
  chartData?: Array<{ date: string; value: number }>;
  comparisonData?: {
    current: number; previous: number;
    change: number; changePercent: number | null;
    currentPeriod: string; previousPeriod: string;
  };
  disclaimer?: string;
}

export const executeQuery = async (
  userId: string,
  parsed: ParsedQuery
): Promise<QueryResult> => {
  const { startDate, endDate } = getDateRange(parsed.period);
  const { startDate: prevStart, endDate: prevEnd } = getPreviousPeriod(startDate, endDate);
  const period = { startDate, endDate };

  // Get user's connected accounts
  const accounts = await prisma.connectedAccount.findMany({
    where: { userId, status: 'active' },
  });

  const ytAccounts = accounts.filter(a => a.provider === 'youtube-data');
  const gaAccounts = accounts.filter(a => a.provider === 'google-analytics');

  const ytChannels = ytAccounts.length > 0
    ? await prisma.youTubeChannel.findMany({ where: { connectedAccountId: { in: ytAccounts.map(a => a.id) } } })
    : [];
  const channelIds = ytChannels.map(c => c.channelId);

  const gaProperties = gaAccounts.length > 0
    ? await prisma.googleAnalyticsProperty.findMany({ where: { connectedAccountId: { in: gaAccounts.map(a => a.id) } } })
    : [];
  const propIds = gaProperties.map(p => p.propertyId);

  switch (parsed.intent) {

    // ── YouTube: Subscribers ────────────────────────────────────────────────
    case 'get_subscribers': {
      if (!channelIds.length) return noData('No YouTube account connected');
      const metrics = await prisma.youTubeChannelMetric.findMany({
        where: { channelId: { in: channelIds }, date: { gte: startDate, lte: endDate } },
      });
      const gained = metrics.reduce((s, m) => s + (m.subscribersGained ?? 0), 0);
      const lost = metrics.reduce((s, m) => s + (m.subscribersLost ?? 0), 0);
      const net = gained - lost;
      const totalSubs = ytChannels.reduce((s, c) => s + (c.subscriberCount ?? 0), 0);
      if (parsed.compareWithPrevious) {
        const prevMetrics = await prisma.youTubeChannelMetric.findMany({
          where: { channelId: { in: channelIds }, date: { gte: prevStart, lte: prevEnd } },
        });
        const prevNet = prevMetrics.reduce((s, m) => s + ((m.subscribersGained ?? 0) - (m.subscribersLost ?? 0)), 0);
        return { found: true, source: 'YouTube Analytics', period, value: net, unit: 'net subscribers',
          comparisonData: buildComparison(net, prevNet, startDate, endDate, prevStart, prevEnd),
          rows: [{ metric: 'Subscribers Gained', value: gained }, { metric: 'Subscribers Lost', value: lost }, { metric: 'Net Change', value: net }, { metric: 'Total Subscribers', value: totalSubs }] };
      }
      return { found: true, source: 'YouTube Analytics', period, value: net, unit: 'net subscribers',
        rows: [{ metric: 'Subscribers Gained', value: gained }, { metric: 'Subscribers Lost', value: lost }, { metric: 'Net Change', value: net }, { metric: 'Current Total', value: totalSubs }] };
    }

    // ── YouTube: Views ──────────────────────────────────────────────────────
    case 'get_views': {
      if (!channelIds.length) return noData('No YouTube account connected');
      const metrics = await prisma.youTubeChannelMetric.findMany({
        where: { channelId: { in: channelIds }, date: { gte: startDate, lte: endDate } },
        orderBy: { date: 'asc' },
      });
      const total = metrics.reduce((s, m) => s + (m.views ?? 0), 0);
      const chartData = metrics.map(m => ({ date: m.date, value: m.views ?? 0 }));
      if (parsed.compareWithPrevious) {
        const prevM = await prisma.youTubeChannelMetric.findMany({ where: { channelId: { in: channelIds }, date: { gte: prevStart, lte: prevEnd } } });
        const prevTotal = prevM.reduce((s, m) => s + (m.views ?? 0), 0);
        return { found: true, source: 'YouTube Analytics', period, value: total, unit: 'views', chartData, comparisonData: buildComparison(total, prevTotal, startDate, endDate, prevStart, prevEnd) };
      }
      return { found: true, source: 'YouTube Analytics', period, value: total, unit: 'views', chartData };
    }

    // ── YouTube: Watch Time ─────────────────────────────────────────────────
    case 'get_watch_time': {
      if (!channelIds.length) return noData('No YouTube account connected');
      const metrics = await prisma.youTubeChannelMetric.findMany({
        where: { channelId: { in: channelIds }, date: { gte: startDate, lte: endDate } },
        orderBy: { date: 'asc' },
      });
      const totalMin = metrics.reduce((s, m) => s + (m.estimatedMinutesWatched ?? 0), 0);
      const totalHrs = Math.round(totalMin / 60);
      return { found: true, source: 'YouTube Analytics', period, value: totalHrs, unit: 'hours watched',
        rows: [{ metric: 'Total Watch Time', value: `${totalHrs.toLocaleString()} hours (${totalMin.toLocaleString()} minutes)` }],
        chartData: metrics.map(m => ({ date: m.date, value: Math.round((m.estimatedMinutesWatched ?? 0) / 60) })) };
    }

    // ── YouTube: Revenue ────────────────────────────────────────────────────
    case 'get_revenue': {
      if (!channelIds.length) return noData('No YouTube account connected');
      const metrics = await prisma.youTubeChannelMetric.findMany({
        where: { channelId: { in: channelIds }, date: { gte: startDate, lte: endDate } },
        orderBy: { date: 'asc' },
      });
      const hasRevenue = metrics.some(m => m.estimatedRevenue !== null);
      if (!hasRevenue) return noData('Revenue data not available. This requires YouTube channel monetization and the yt-analytics-monetary scope.', 'YouTube Analytics');
      const total = metrics.reduce((s, m) => s + (m.estimatedRevenue ?? 0), 0);
      const totalAd = metrics.reduce((s, m) => s + (m.estimatedAdRevenue ?? 0), 0);
      return { found: true, source: 'YouTube Analytics', period, value: total, unit: 'USD (estimated)',
        disclaimer: 'Revenue is estimated. Finalized amounts appear in YouTube Studio after the payment cycle.',
        rows: [{ metric: 'Estimated Total Revenue', value: `$${total.toFixed(2)}` }, { metric: 'Estimated Ad Revenue', value: `$${totalAd.toFixed(2)}` }],
        chartData: metrics.map(m => ({ date: m.date, value: m.estimatedRevenue ?? 0 })) };
    }

    // ── YouTube: Impressions ────────────────────────────────────────────────
    case 'get_impressions': {
      if (!channelIds.length) return noData('No YouTube account connected');
      const metrics = await prisma.youTubeChannelMetric.findMany({
        where: { channelId: { in: channelIds }, date: { gte: startDate, lte: endDate } },
      });
      const hasImpressions = metrics.some(m => m.impressions !== null);
      if (!hasImpressions) return noData('Impression data not available for this channel', 'YouTube Analytics');
      const total = metrics.reduce((s, m) => s + (m.impressions ?? 0), 0);
      return { found: true, source: 'YouTube Analytics', period, value: total, unit: 'impressions' };
    }

    // ── YouTube: CTR ────────────────────────────────────────────────────────
    case 'get_ctr': {
      if (!channelIds.length) return noData('No YouTube account connected');
      const metrics = await prisma.youTubeChannelMetric.findMany({
        where: { channelId: { in: channelIds }, date: { gte: startDate, lte: endDate } },
      });
      const withCTR = metrics.filter(m => m.impressionClickThroughRate !== null);
      if (!withCTR.length) return noData('CTR data not available', 'YouTube Analytics');
      const avgCTR = withCTR.reduce((s, m) => s + (m.impressionClickThroughRate ?? 0), 0) / withCTR.length;
      return { found: true, source: 'YouTube Analytics', period, value: Math.round(avgCTR * 1000) / 10, unit: '% (average CTR)' };
    }

    // ── YouTube: Likes ──────────────────────────────────────────────────────
    case 'get_likes': {
      if (!channelIds.length) return noData('No YouTube account connected');
      const metrics = await prisma.youTubeChannelMetric.findMany({ where: { channelId: { in: channelIds }, date: { gte: startDate, lte: endDate } } });
      return { found: true, source: 'YouTube Analytics', period, value: metrics.reduce((s, m) => s + (m.likes ?? 0), 0), unit: 'likes' };
    }

    // ── YouTube: Comments ───────────────────────────────────────────────────
    case 'get_comments': {
      if (!channelIds.length) return noData('No YouTube account connected');
      const metrics = await prisma.youTubeChannelMetric.findMany({ where: { channelId: { in: channelIds }, date: { gte: startDate, lte: endDate } } });
      return { found: true, source: 'YouTube Analytics', period, value: metrics.reduce((s, m) => s + (m.comments ?? 0), 0), unit: 'comments' };
    }

    // ── YouTube: Shares ─────────────────────────────────────────────────────
    case 'get_shares': {
      if (!channelIds.length) return noData('No YouTube account connected');
      const metrics = await prisma.youTubeChannelMetric.findMany({ where: { channelId: { in: channelIds }, date: { gte: startDate, lte: endDate } } });
      return { found: true, source: 'YouTube Analytics', period, value: metrics.reduce((s, m) => s + (m.shares ?? 0), 0), unit: 'shares' };
    }

    // ── YouTube: Top Videos ─────────────────────────────────────────────────
    case 'get_top_videos': {
      if (!channelIds.length) return noData('No YouTube account connected');
      const videos = await prisma.youTubeVideo.findMany({
        where: { channelId: { in: channelIds } },
        orderBy: { viewCount: 'desc' },
        take: parsed.topN,
      });
      return { found: true, source: 'YouTube Data API', period,
        rows: videos.map((v, i) => ({ rank: i + 1, title: v.title, videoId: v.videoId, views: v.viewCount ?? 0, likes: v.likeCount ?? 0, comments: v.commentCount ?? 0, published: v.publishedAt?.toISOString().split('T')[0] ?? 'N/A' })) };
    }

    // ── GA: Sessions ────────────────────────────────────────────────────────
    case 'get_sessions': {
      if (!propIds.length) return noData('No Google Analytics account connected');
      const metrics = await prisma.googleAnalyticsMetric.findMany({
        where: { propertyId: { in: propIds }, date: { gte: startDate, lte: endDate } },
        orderBy: { date: 'asc' },
      });
      const total = metrics.reduce((s, m) => s + (m.sessions ?? 0), 0);
      if (parsed.compareWithPrevious) {
        const prevM = await prisma.googleAnalyticsMetric.findMany({ where: { propertyId: { in: propIds }, date: { gte: prevStart, lte: prevEnd } } });
        const prevTotal = prevM.reduce((s, m) => s + (m.sessions ?? 0), 0);
        return { found: true, source: 'Google Analytics 4', period, value: total, unit: 'sessions', comparisonData: buildComparison(total, prevTotal, startDate, endDate, prevStart, prevEnd) };
      }
      return { found: true, source: 'Google Analytics 4', period, value: total, unit: 'sessions',
        chartData: metrics.map(m => ({ date: m.date, value: m.sessions ?? 0 })) };
    }

    // ── GA: Users ───────────────────────────────────────────────────────────
    case 'get_users': {
      if (!propIds.length) return noData('No Google Analytics account connected');
      const metrics = await prisma.googleAnalyticsMetric.findMany({ where: { propertyId: { in: propIds }, date: { gte: startDate, lte: endDate } } });
      return { found: true, source: 'Google Analytics 4', period, value: metrics.reduce((s, m) => s + (m.activeUsers ?? 0), 0), unit: 'active users' };
    }

    // ── GA: Traffic Sources ─────────────────────────────────────────────────
    case 'get_traffic_sources': {
      if (!propIds.length) return noData('No Google Analytics account connected');
      const metrics = await prisma.googleAnalyticsMetric.findMany({ where: { propertyId: { in: propIds }, date: { gte: startDate, lte: endDate } } });
      const sourceMap = new Map<string, number>();
      for (const m of metrics) {
        if (!m.source) continue;
        try {
          for (const [src, count] of JSON.parse(m.source) as [string, number][]) {
            sourceMap.set(src, (sourceMap.get(src) ?? 0) + count);
          }
        } catch { /* skip */ }
      }
      const rows = [...sourceMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, parsed.topN).map(([source, sessions], i) => ({ rank: i + 1, source, sessions }));
      return { found: true, source: 'Google Analytics 4', period, rows };
    }

    // ── GA: Top Pages ───────────────────────────────────────────────────────
    case 'get_top_pages': {
      if (!propIds.length) return noData('No Google Analytics account connected');
      const latest = await prisma.googleAnalyticsMetric.findFirst({ where: { propertyId: { in: propIds }, topPages: { not: null } }, orderBy: { date: 'desc' } });
      if (!latest?.topPages) return noData('Top pages data not yet synced', 'Google Analytics 4');
      const pages = (JSON.parse(latest.topPages) as Array<Record<string, unknown>>).slice(0, parsed.topN);
      return { found: true, source: 'Google Analytics 4', period, rows: pages.map((p, i) => ({ rank: i + 1, ...p })) };
    }

    // ── Engagement summary ──────────────────────────────────────────────────
    case 'get_engagement': {
      const result: Record<string, unknown>[] = [];
      if (channelIds.length) {
        const m = await prisma.youTubeChannelMetric.findMany({ where: { channelId: { in: channelIds }, date: { gte: startDate, lte: endDate } } });
        result.push({ platform: 'YouTube', likes: m.reduce((s, x) => s + (x.likes ?? 0), 0), comments: m.reduce((s, x) => s + (x.comments ?? 0), 0), shares: m.reduce((s, x) => s + (x.shares ?? 0), 0) });
      }
      if (propIds.length) {
        const m = await prisma.googleAnalyticsMetric.findMany({ where: { propertyId: { in: propIds }, date: { gte: startDate, lte: endDate } } });
        const avgEngagement = m.length ? m.reduce((s, x) => s + (x.engagementRate ?? 0), 0) / m.length : 0;
        result.push({ platform: 'Google Analytics', avgEngagementRate: `${(avgEngagement * 100).toFixed(1)}%`, sessions: m.reduce((s, x) => s + (x.sessions ?? 0), 0) });
      }
      return { found: result.length > 0, source: 'Multiple', period, rows: result };
    }

    // ── Overview ────────────────────────────────────────────────────────────
    case 'get_overview':
    default: {
      const rows: Record<string, unknown>[] = [];
      if (channelIds.length) {
        const m = await prisma.youTubeChannelMetric.findMany({ where: { channelId: { in: channelIds }, date: { gte: startDate, lte: endDate } } });
        rows.push({ platform: 'YouTube', views: m.reduce((s, x) => s + (x.views ?? 0), 0), subscribersGained: m.reduce((s, x) => s + (x.subscribersGained ?? 0), 0), watchHours: Math.round(m.reduce((s, x) => s + (x.estimatedMinutesWatched ?? 0), 0) / 60) });
      }
      if (propIds.length) {
        const m = await prisma.googleAnalyticsMetric.findMany({ where: { propertyId: { in: propIds }, date: { gte: startDate, lte: endDate } } });
        rows.push({ platform: 'Google Analytics', sessions: m.reduce((s, x) => s + (x.sessions ?? 0), 0), activeUsers: m.reduce((s, x) => s + (x.activeUsers ?? 0), 0) });
      }
      return { found: rows.length > 0, source: 'All Connected Accounts', period, rows };
    }
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const noData = (message: string, source = 'No Source'): QueryResult => ({
  found: false, source, period: { startDate: '', endDate: '' },
  disclaimer: message,
});

const buildComparison = (
  current: number, previous: number,
  startDate: string, endDate: string,
  prevStart: string, prevEnd: string
) => ({
  current, previous,
  change: current - previous,
  changePercent: previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10,
  currentPeriod: `${startDate} to ${endDate}`,
  previousPeriod: `${prevStart} to ${prevEnd}`,
});
