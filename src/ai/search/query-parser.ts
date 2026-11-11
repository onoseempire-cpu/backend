/**
 * AI Search Engine — Rule-Based NLP Query Parser
 * Converts natural-language questions into structured query intents.
 * No external LLM required. Fully offline, deterministic.
 */

export type QueryIntent =
  | 'get_subscribers'
  | 'get_views'
  | 'get_watch_time'
  | 'get_revenue'
  | 'get_impressions'
  | 'get_ctr'
  | 'get_likes'
  | 'get_comments'
  | 'get_shares'
  | 'get_top_videos'
  | 'get_top_pages'
  | 'get_traffic_sources'
  | 'get_sessions'
  | 'get_users'
  | 'compare_periods'
  | 'get_overview'
  | 'get_growth'
  | 'get_engagement'
  | 'unknown';

export type DataSource = 'youtube' | 'google-analytics' | 'adsense' | 'search-console' | 'any';

export type TimePeriod = '7d' | '28d' | '30d' | '90d' | '365d' | 'this_month' | 'last_month' | 'this_year' | 'today';

export interface ParsedQuery {
  intent: QueryIntent;
  source: DataSource;
  period: TimePeriod;
  compareWithPrevious: boolean;
  topN: number;
  filters: {
    videoTitle?: string;
    channelName?: string;
    metric?: string;
  };
  confidence: 'high' | 'medium' | 'low';
  originalQuery: string;
}

// ── Keyword maps ──────────────────────────────────────────────────────────────

const SUBSCRIBER_WORDS = ['subscriber', 'subscribers', 'sub', 'subs', 'follower', 'followers', 'gained'];
const VIEWS_WORDS = ['view', 'views', 'watched', 'watch', 'seen'];
const WATCH_TIME_WORDS = ['watch time', 'watchtime', 'minutes watched', 'hours watched', 'watch hours', 'viewing time', 'retention'];
const REVENUE_WORDS = ['revenue', 'earning', 'earnings', 'money', 'income', 'paid', 'payment', 'monetization', 'cpm', 'rpm'];
const IMPRESSION_WORDS = ['impression', 'impressions', 'reach'];
const CTR_WORDS = ['ctr', 'click through', 'click-through', 'clickthrough'];
const LIKES_WORDS = ['like', 'likes', 'thumbs up'];
const COMMENTS_WORDS = ['comment', 'comments'];
const SHARES_WORDS = ['share', 'shares', 'shared'];
const TOP_VIDEO_WORDS = ['best video', 'top video', 'top videos', 'best videos', 'highest', 'most viewed', 'popular video', 'performing video'];
const TOP_PAGE_WORDS = ['top page', 'best page', 'popular page', 'most visited', 'top content'];
const TRAFFIC_WORDS = ['traffic source', 'traffic sources', 'where do', 'where are', 'traffic', 'channel source', 'referral', 'organic', 'direct'];
const SESSIONS_WORDS = ['session', 'sessions', 'visit', 'visits'];
const USERS_WORDS = ['user', 'users', 'visitor', 'visitors', 'active user'];
const COMPARE_WORDS = ['compare', 'comparison', 'vs', 'versus', 'this week vs', 'this month vs', 'difference', 'change', 'growth'];
const OVERVIEW_WORDS = ['overview', 'summary', 'total', 'all metrics', 'dashboard', 'everything', 'performance'];
const GROWTH_WORDS = ['growth', 'grew', 'increase', 'growing', 'trend', 'improvement'];
const ENGAGEMENT_WORDS = ['engagement', 'engage', 'interaction', 'interact', 'audience engagement'];

const YOUTUBE_WORDS = ['youtube', 'channel', 'video', 'yt'];
const GA_WORDS = ['google analytics', 'analytics', 'website', 'site', 'web traffic', 'page views', 'ga', 'ga4'];
const ADSENSE_WORDS = ['adsense', 'ad sense', 'ads', 'advertisement'];
const SEARCH_CONSOLE_WORDS = ['search console', 'seo', 'search', 'google search', 'keyword', 'query', 'ranking'];

const PERIOD_MAP: Array<[RegExp, TimePeriod]> = [
  [/\btoday\b/i, 'today'],
  [/\bthis week\b/i, '7d'],
  [/\blast 7 days?\b/i, '7d'],
  [/\bthis month\b/i, 'this_month'],
  [/\blast month\b/i, 'last_month'],
  [/\blast 30 days?\b/i, '30d'],
  [/\blast 28 days?\b/i, '28d'],
  [/\blast 3 months?\b/i, '90d'],
  [/\bthis year\b/i, 'this_year'],
  [/\blast year\b/i, '365d'],
  [/\blast 365 days?\b/i, '365d'],
  [/\blast 90 days?\b/i, '90d'],
];

// ── Helper ────────────────────────────────────────────────────────────────────
const contains = (q: string, words: string[]) =>
  words.some(w => q.toLowerCase().includes(w.toLowerCase()));

const matchIntent = (q: string): { intent: QueryIntent; confidence: 'high' | 'medium' | 'low' } => {
  const lq = q.toLowerCase();

  // High confidence — explicit metric names
  if (contains(lq, SUBSCRIBER_WORDS)) return { intent: 'get_subscribers', confidence: 'high' };
  if (contains(lq, WATCH_TIME_WORDS)) return { intent: 'get_watch_time', confidence: 'high' };
  if (contains(lq, REVENUE_WORDS)) return { intent: 'get_revenue', confidence: 'high' };
  if (contains(lq, CTR_WORDS)) return { intent: 'get_ctr', confidence: 'high' };
  if (contains(lq, IMPRESSION_WORDS)) return { intent: 'get_impressions', confidence: 'high' };
  if (contains(lq, COMPARE_WORDS)) return { intent: 'compare_periods', confidence: 'high' };

  // Top/best queries
  if (contains(lq, TOP_VIDEO_WORDS)) return { intent: 'get_top_videos', confidence: 'high' };
  if (contains(lq, TOP_PAGE_WORDS)) return { intent: 'get_top_pages', confidence: 'high' };

  // Medium confidence
  if (contains(lq, ENGAGEMENT_WORDS)) return { intent: 'get_engagement', confidence: 'medium' };
  if (contains(lq, GROWTH_WORDS)) return { intent: 'get_growth', confidence: 'medium' };
  if (contains(lq, TRAFFIC_WORDS)) return { intent: 'get_traffic_sources', confidence: 'medium' };
  if (contains(lq, VIEWS_WORDS)) return { intent: 'get_views', confidence: 'medium' };
  if (contains(lq, LIKES_WORDS)) return { intent: 'get_likes', confidence: 'medium' };
  if (contains(lq, COMMENTS_WORDS)) return { intent: 'get_comments', confidence: 'medium' };
  if (contains(lq, SHARES_WORDS)) return { intent: 'get_shares', confidence: 'medium' };
  if (contains(lq, SESSIONS_WORDS)) return { intent: 'get_sessions', confidence: 'medium' };
  if (contains(lq, USERS_WORDS)) return { intent: 'get_users', confidence: 'medium' };
  if (contains(lq, OVERVIEW_WORDS)) return { intent: 'get_overview', confidence: 'medium' };

  return { intent: 'unknown', confidence: 'low' };
};

const matchSource = (q: string): DataSource => {
  const lq = q.toLowerCase();
  if (contains(lq, ADSENSE_WORDS)) return 'adsense';
  if (contains(lq, SEARCH_CONSOLE_WORDS)) return 'search-console';
  if (contains(lq, GA_WORDS)) return 'google-analytics';
  if (contains(lq, YOUTUBE_WORDS)) return 'youtube';
  return 'any';
};

const matchPeriod = (q: string): TimePeriod => {
  for (const [pattern, period] of PERIOD_MAP) {
    if (pattern.test(q)) return period;
  }
  return '30d'; // Default to last 30 days
};

const extractTopN = (q: string): number => {
  const match = q.match(/\b(top\s+)?(\d+)\b/i);
  if (match) {
    const n = parseInt(match[2]);
    if (n >= 1 && n <= 100) return n;
  }
  return 10;
};

const hasCompare = (q: string) =>
  COMPARE_WORDS.some(w => q.toLowerCase().includes(w)) ||
  /vs|versus|compared/i.test(q);

// ── Main export ───────────────────────────────────────────────────────────────

export const parseQuery = (query: string): ParsedQuery => {
  const { intent, confidence } = matchIntent(query);

  // Source inference with intent override
  let source = matchSource(query);
  if (source === 'any') {
    if (['get_subscribers', 'get_watch_time', 'get_top_videos', 'get_ctr', 'get_impressions'].includes(intent)) {
      source = 'youtube';
    } else if (['get_sessions', 'get_users', 'get_top_pages', 'get_traffic_sources'].includes(intent)) {
      source = 'google-analytics';
    }
  }

  return {
    intent,
    source,
    period: matchPeriod(query),
    compareWithPrevious: hasCompare(query),
    topN: extractTopN(query),
    filters: {},
    confidence,
    originalQuery: query,
  };
};
