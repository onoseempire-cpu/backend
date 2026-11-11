import { Router, Request, Response, NextFunction } from 'express';
import { AIController } from '../controllers/ai.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { apiRateLimit } from '../middleware/rate-limit';
import type { AuthenticatedRequest } from '../types/auth';

const router = Router();
const auth = authenticateJWT as unknown as (req: Request, res: Response, next: NextFunction) => void;
const toAuth = (fn: (r: AuthenticatedRequest, res: Response, next: NextFunction) => void) =>
  (req: Request, res: Response, next: NextFunction) => fn(req as AuthenticatedRequest, res, next);

router.use(auth);
router.post('/search', apiRateLimit, toAuth(AIController.search));
router.get('/search/history', toAuth(AIController.getSearchHistory));

export default router;
