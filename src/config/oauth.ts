import { google } from 'googleapis';
import { env } from './env';

// ── YouTube Data API OAuth2 Client ───────────────────────────────────────────
// Used for: Channel info, video listing, basic video data
export const createYouTubeDataClient = () =>
  new google.auth.OAuth2(
    env.YOUTUBE_DATA_CLIENT_ID,
    env.YOUTUBE_DATA_CLIENT_SECRET,
    env.YOUTUBE_DATA_REDIRECT_URI
  );

// ── YouTube Analytics API OAuth2 Client ──────────────────────────────────────
// Used for: Channel metrics (views, watch time, revenue, subscribers, etc.)
export const createYouTubeAnalyticsClient = () =>
  new google.auth.OAuth2(
    env.YOUTUBE_ANALYTICS_CLIENT_ID,
    env.YOUTUBE_ANALYTICS_CLIENT_SECRET,
    env.YOUTUBE_ANALYTICS_REDIRECT_URI
  );

// ── YouTube Reporting API OAuth2 Client ──────────────────────────────────────
// Used for: Detailed revenue reporting (advanced monetization data)
export const createYouTubeReportingClient = () =>
  new google.auth.OAuth2(
    env.YOUTUBE_REPORTING_CLIENT_ID,
    env.YOUTUBE_REPORTING_CLIENT_SECRET,
    env.YOUTUBE_REPORTING_REDIRECT_URI
  );

// ── Google AdSense API OAuth2 Client ───────────────────────────────────────
// Used for: AdSense earnings and reporting
export const createAdSenseClient = () =>
  new google.auth.OAuth2(
    env.GOOGLE_ADSENSE_CLIENT_ID,
    env.GOOGLE_ADSENSE_CLIENT_SECRET,
    env.GOOGLE_ADSENSE_REDIRECT_URI
  );

// ── Google Analytics 4 Data API OAuth2 Client ───────────────────────────────
// Used for: Website/app analytics (sessions, users, conversion, etc.)
export const createGoogleAnalyticsClient = () =>
  new google.auth.OAuth2(
    env.GOOGLE_ANALYTICS_CLIENT_ID,
    env.GOOGLE_ANALYTICS_CLIENT_SECRET,
    env.GOOGLE_ANALYTICS_REDIRECT_URI
  );

// ── Google Search Console API OAuth2 Client ─────────────────────────────────
// Used for: SEO, search queries, page performance in Google Search
export const createSearchConsoleClient = () =>
  new google.auth.OAuth2(
    env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID,
    env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET,
    env.GOOGLE_SEARCH_CONSOLE_REDIRECT_URI
  );

// ── OAuth Scopes ─────────────────────────────────────────────────────────────
export const OAUTH_SCOPES = {
  youtubeData: [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
  youtubeAnalytics: [
    'https://www.googleapis.com/auth/yt-analytics.readonly',
    'https://www.googleapis.com/auth/yt-analytics-monetary.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
  youtubeReporting: [
    'https://www.googleapis.com/auth/yt-analytics.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
  adsense: [
    'https://www.googleapis.com/auth/adsense.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
  googleAnalytics: [
    'https://www.googleapis.com/auth/analytics.readonly',
    'https://www.googleapis.com/auth/analytics.manage.users.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
  searchConsole: [
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
} as const;

// ── Provider Type Definitions ────────────────────────────────────────────────
export type IntegrationProvider =
  | 'youtubeData'
  | 'youtubeAnalytics'
  | 'youtubeReporting'
  | 'adsense'
  | 'googleAnalytics'
  | 'searchConsole';

// ── Client Factory ───────────────────────────────────────────────────────────
export const getClientForProvider = (provider: IntegrationProvider) => {
  const clientMap: Record<IntegrationProvider, ReturnType<typeof createYouTubeDataClient>> = {
    'youtubeData': createYouTubeDataClient(),
    'youtubeAnalytics': createYouTubeAnalyticsClient(),
    'youtubeReporting': createYouTubeReportingClient(),
    'adsense': createAdSenseClient(),
    'googleAnalytics': createGoogleAnalyticsClient(),
    'searchConsole': createSearchConsoleClient(),
  };
  return clientMap[provider];
};

// ── Provider Info ────────────────────────────────────────────────────────────
export const PROVIDER_INFO: Record<IntegrationProvider, {
  name: string;
  description: string;
  scopes: readonly string[];
  usesReporting?: boolean;
}> = {
  'youtubeData': {
    name: 'YouTube Data',
    description: 'Channel info, video listing, basic video data',
    scopes: OAUTH_SCOPES.youtubeData,
  },
  'youtubeAnalytics': {
    name: 'YouTube Analytics',
    description: 'Metrics: views, watch time, revenue, subscribers',
    scopes: OAUTH_SCOPES.youtubeAnalytics,
    usesReporting: true,
  },
  'youtubeReporting': {
    name: 'YouTube Reporting',
    description: 'Detailed monetization reports',
    scopes: OAUTH_SCOPES.youtubeReporting,
  },
  'adsense': {
    name: 'AdSense',
    description: 'AdSense earnings and reporting',
    scopes: OAUTH_SCOPES.adsense,
  },
  'googleAnalytics': {
    name: 'Google Analytics 4',
    description: 'Website analytics: sessions, users, conversion',
    scopes: OAUTH_SCOPES.googleAnalytics,
  },
  'searchConsole': {
    name: 'Search Console',
    description: 'SEO data: search queries, page performance',
    scopes: OAUTH_SCOPES.searchConsole,
  },
};