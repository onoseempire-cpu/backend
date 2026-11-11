import { google } from 'googleapis';
import { env } from './env';

// ── YouTube Data API OAuth2 Client ───────────────────────────────────────────
export const createYouTubeDataClient = () =>
  new google.auth.OAuth2(
    env.YOUTUBE_DATA_CLIENT_ID,
    env.YOUTUBE_DATA_CLIENT_SECRET,
    env.YOUTUBE_DATA_REDIRECT_URI
  );

// ── YouTube Analytics API OAuth2 Client ──────────────────────────────────────
export const createYouTubeAnalyticsClient = () =>
  new google.auth.OAuth2(
    env.YOUTUBE_ANALYTICS_CLIENT_ID,
    env.YOUTUBE_ANALYTICS_CLIENT_SECRET,
    env.YOUTUBE_ANALYTICS_REDIRECT_URI
  );

// ── YouTube Reporting API OAuth2 Client ──────────────────────────────────────
export const createYouTubeReportingClient = () =>
  new google.auth.OAuth2(
    env.YOUTUBE_REPORTING_CLIENT_ID,
    env.YOUTUBE_REPORTING_CLIENT_SECRET,
    env.YOUTUBE_REPORTING_REDIRECT_URI
  );

// ── Google AdSense / Analytics / Search Console OAuth2 Client ────────────────
export const createGoogleClient = (redirectUri?: string) =>
  new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

export const createAdSenseClient = () =>
  createGoogleClient(env.GOOGLE_ADSENSE_REDIRECT_URI);

export const createGoogleAnalyticsClient = () =>
  createGoogleClient(env.GOOGLE_ANALYTICS_REDIRECT_URI);

export const createSearchConsoleClient = () =>
  createGoogleClient(env.GOOGLE_SEARCH_CONSOLE_REDIRECT_URI);

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
  googleAnalytics: [
    'https://www.googleapis.com/auth/analytics.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
  adSense: [
    'https://www.googleapis.com/auth/adsense.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
  searchConsole: [
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
} as const;
