import { Router, Request, Response, NextFunction } from 'express';
import { IntegrationsController } from '../controllers/integrations.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { auditLog } from '../middleware/audit';

const router = Router();
router.use(authenticateJWT as never);

router.get('/', IntegrationsController.getAll as never);
router.get('/status', IntegrationsController.getStatus as never);

router.get('/youtube-data/connect', IntegrationsController.getConnectUrl('youtube-data') as never);
router.get('/youtube-data/callback', IntegrationsController.handleCallback('youtube-data') as never);

router.get('/youtube-analytics/connect', IntegrationsController.getConnectUrl('youtube-analytics') as never);
router.get('/youtube-analytics/callback', IntegrationsController.handleCallback('youtube-analytics') as never);

router.get('/youtube-reporting/connect', IntegrationsController.getConnectUrl('youtube-reporting') as never);
router.get('/youtube-reporting/callback', IntegrationsController.handleCallback('youtube-reporting') as never);

router.get('/adsense/connect', IntegrationsController.getConnectUrl('adsense') as never);
router.get('/adsense/callback', IntegrationsController.handleCallback('adsense') as never);

router.get('/google-analytics/connect', IntegrationsController.getConnectUrl('google-analytics') as never);
router.get('/google-analytics/callback', IntegrationsController.handleCallback('google-analytics') as never);

router.get('/search-console/connect', IntegrationsController.getConnectUrl('search-console') as never);
router.get('/search-console/callback', IntegrationsController.handleCallback('search-console') as never);

router.delete('/:accountId', auditLog('account.disconnect') as never, IntegrationsController.disconnect as never);

export default router;
