import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { auditLog } from '../middleware/audit';

const router = Router();

// All analytics routes require authentication
router.use(authenticateJWT as never);

// ── Analytics Overview ───────────────────────────────────────────────────────────
// GET /api/v1/analytics/overview?period=30d
router.get('/overview', auditLog('analytics.view') as never, AnalyticsController.overview as never);

// ── YouTube Analytics ────────────────────────────────────────────────────────────
// GET /api/v1/analytics/youtube?period=30d&channelId=...
router.get('/youtube', AnalyticsController.youtube as never);

// GET /api/v1/analytics/youtube/videos?channelId=...&limit=50&sortBy=viewCount
router.get('/youtube/videos', AnalyticsController.youtubeVideos as never);

// ── Google Analytics 4 Data ──────────────────────────────────────────────────────
// GET /api/v1/analytics/google-analytics?period=30d&propertyId=...
router.get('/google-analytics', AnalyticsController.googleAnalytics as never);

export default router;