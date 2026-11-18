import { Router } from 'express';
import { IntegrationsController } from '../controllers';
import { authenticateJWT } from '../middleware/auth.middleware';
import { auditLog } from '../middleware/audit';

const router = Router();

router.use(authenticateJWT as never);

// ── List all connected accounts ───────────────────────────────────────────────
router.get('/', IntegrationsController.getAll as never);

// ── Get integration status summary ────────────────────────────────────────────
router.get('/status', IntegrationsController.getStatus as never);

// ── YouTube Data API (basic channel/video info) ───────────────────────────────
router.get('/youtube-data/connect', IntegrationsController.getConnectUrl('youtubeData') as never);
router.get('/youtube-data/callback', IntegrationsController.handleCallback('youtubeData') as never);

// ── YouTube Analytics API (metrics) ────────────────────────────────────────────
router.get('/youtube-analytics/connect', IntegrationsController.getConnectUrl('youtubeAnalytics') as never);
router.get('/youtube-analytics/callback', IntegrationsController.handleCallback('youtubeAnalytics') as never);

// ── YouTube Reporting API (detailed revenue reports) ───────────────────────────
router.get('/youtube-reporting/connect', IntegrationsController.getConnectUrl('youtubeReporting') as never);
router.get('/youtube-reporting/callback', IntegrationsController.handleCallback('youtubeReporting') as never);

// ── Google AdSense API ───────────────────────────────────────────────────────────
router.get('/adsense/connect', IntegrationsController.getConnectUrl('adsense') as never);
router.get('/adsense/callback', IntegrationsController.handleCallback('adsense') as never);

// ── Google Analytics 4 Data API ───────────────────────────────────────────────────
router.get('/google-analytics/connect', IntegrationsController.getConnectUrl('googleAnalytics') as never);
router.get('/google-analytics/callback', IntegrationsController.handleCallback('googleAnalytics') as never);

// ── Google Search Console API ──────────────────────────────────────────────────
router.get('/search-console/connect', IntegrationsController.getConnectUrl('searchConsole') as never);
router.get('/search-console/callback', IntegrationsController.handleCallback('searchConsole') as never);

// ── Disconnect an account ───────────────────────────────────────────────────────
router.delete('/:accountId', auditLog('account.disconnect') as never, IntegrationsController.disconnect as never);

export default router;