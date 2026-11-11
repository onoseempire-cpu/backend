import { Router, Request, Response, NextFunction } from 'express';
import { CrawlerController } from '../controllers/crawler.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../types/auth';

const router = Router();
const auth = authenticateJWT as unknown as (req: Request, res: Response, next: NextFunction) => void;
const toAuth = (fn: (r: AuthenticatedRequest, res: Response, next: NextFunction) => void) =>
  (req: Request, res: Response, next: NextFunction) => fn(req as AuthenticatedRequest, res, next);

router.use(auth);
router.post('/start', toAuth(CrawlerController.start));
router.post('/pause', toAuth(CrawlerController.pause));
router.post('/resume', toAuth(CrawlerController.resume));
router.post('/stop', toAuth(CrawlerController.stop));
router.get('/status', toAuth(CrawlerController.status));

export default router;
