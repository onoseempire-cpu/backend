import { Router, Request, Response, NextFunction } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../types/auth';

const router = Router();
const auth = authenticateJWT as unknown as (req: Request, res: Response, next: NextFunction) => void;
const toAuth = (fn: (r: AuthenticatedRequest, res: Response, next: NextFunction) => void) =>
  (req: Request, res: Response, next: NextFunction) => fn(req as AuthenticatedRequest, res, next);

router.use(auth);
router.get('/overview', toAuth(AnalyticsController.overview));
router.get('/youtube', toAuth(AnalyticsController.youtube));
router.get('/youtube/videos', toAuth(AnalyticsController.youtubeVideos));
router.get('/google-analytics', toAuth(AnalyticsController.googleAnalytics));

export default router;
