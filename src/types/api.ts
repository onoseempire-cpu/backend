/**
 * API Response Types — shared between backend and frontend
 * These types are designed to be copy-pasteable into the React/Electron frontend.
 */

// ── Generic Response Shapes ──────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    lastSync?: string | null;
    reportingDelay?: string;
    unreadCount?: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface LoginResponse {
  user: UserProfile;
  accessToken: string;
}

// ── Connected Accounts ───────────────────────────────────────────────────────

export interface ConnectedAccount {
  id: string;
  provider: string;
  providerAccountId: string;
  displayName: string | null;
  email: string | null;
  profileImageUrl: string | null;
  status: 'active' | 'disconnected' | 'error' | 'refreshing';
  lastSyncAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface IntegrationsStatus {
  [provider: string]: {
    connected: boolean;
    accountCount: number;
  };
}

// ── Analytics Overview ───────────────────────────────────────────────────────

export interface OverviewData {
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

// ── YouTube Analytics ────────────────────────────────────────────────────────

export interface YouTubeChannelSummary {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  subscriberCount: number | null;
  viewCount: number | null;
  videoCount: number | null;
}

export interface YouTubeMetricTotals {
  views: number;
  viewsGrowth: number | null;
  watchTimeMinutes: number;
  watchTimeHours: number;
  watchTimeGrowth: number | null;
  subscribersGained: number;
  subscribersLost: number;
  netSubscribers: number;
  subscribersGrowth: number | null;
  likes: number;
  comments: number;
  shares: number;
  estimatedRevenue: number | null;
  impressions: number | null;
  avgCTR: number | null;
}

export interface YouTubeChartPoint {
  date: string;
  views: number;
  watchTime: number;
  subscribers: number;
  revenue: number | null;
  impressions: number | null;
  ctr: number | null;
}

export interface YouTubeTrend {
  direction: 'up' | 'down' | 'flat' | 'unknown';
  slope: number;
  average: number;
  movingAverage: Array<{ date: string; value: number; ma: number }>;
}

export interface YouTubeChannelAnalytics {
  channel: YouTubeChannelSummary;
  period: { startDate: string; endDate: string };
  totals: YouTubeMetricTotals;
  chartData: YouTubeChartPoint[];
  trend: YouTubeTrend;
}

export interface YouTubeVideoRow {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  duration: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

// ── Google Analytics ─────────────────────────────────────────────────────────

export interface GAPropertySummary {
  id: string;
  displayName: string;
  timezone: string | null;
}

export interface GAMetricTotals {
  sessions: number;
  sessionsGrowth: number | null;
  users: number;
  usersGrowth: number | null;
  newUsers: number;
  pageViews: number;
  pageViewsGrowth: number | null;
  avgBounceRate: number | null;
  avgEngagementRate: number | null;
  conversions: number;
}

export interface GAChartPoint {
  date: string;
  sessions: number;
  users: number;
  pageViews: number;
  bounceRate: number | null;
  engagementRate: number | null;
}

export interface GAPropertyAnalytics {
  property: GAPropertySummary;
  period: { startDate: string; endDate: string };
  totals: GAMetricTotals;
  chartData: GAChartPoint[];
  topSources: Array<{ source: string; sessions: number }>;
  topPages: Array<{ path: string; title: string; pageViews: number; users: number }>;
}

// ── AI Search ────────────────────────────────────────────────────────────────

export type AISearchConfidence = 'high' | 'medium' | 'low' | 'unavailable';

export type AISearchDataType = 'number' | 'table' | 'chart' | 'comparison';

export interface AISearchResultData {
  type: AISearchDataType;
  value?: number;
  unit?: string;
  rows?: Record<string, unknown>[];
  columns?: string[];
  chartData?: Array<{ label: string; value: number }>;
  comparisonData?: Array<{
    period: string;
    value: number;
    change: number;
    changePercent: number;
  }>;
}

export interface AISearchResult {
  question: string;
  answer: string;
  confidence: AISearchConfidence;
  source: string;
  reportingPeriod: string;
  data: AISearchResultData;
  disclaimer: string | null;
}

export interface SearchHistoryEntry {
  id: string;
  queryText: string;
  resultSummary: string | null;
  hasResults: boolean;
  responseTimeMs: number | null;
  createdAt: string;
}

// ── Indexer / Crawler ────────────────────────────────────────────────────────

export interface IndexingJobStatus {
  id: string;
  jobType: string;
  status: string;
  progressPercent: number;
  currentStep: string | null;
  recordsProcessed: number;
  recordsFailed: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface CrawlerJobStatus {
  id: string;
  jobType: string;
  status: string;
  progressPercent: number;
  currentStep: string | null;
  itemsProcessed: number;
  itemsUpdated: number;
  itemsFailed: number;
  startedAt: string | null;
  completedAt: string | null;
  lastError: string | null;
}

// ── Reports ──────────────────────────────────────────────────────────────────

export interface ReportSummary {
  id: string;
  title: string;
  reportType: string;
  source: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  createdAt: string;
  exportedAt: string | null;
}

// ── Notifications ────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'sync' | 'indexing' | 'crawler';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// ── Socket Events ─────────────────────────────────────────────────────────────

export interface SocketProgressEvent {
  jobId: string;
  progress: number;
  step: string;
  timestamp: string;
}

export interface SocketAnalyticsUpdatedEvent {
  source?: string;
  accountId?: string;
  timestamp: string;
}
