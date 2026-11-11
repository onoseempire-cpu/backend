import { Router, Request, Response, NextFunction } from 'express';
import { IndexerController } from '../controllers/indexer.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../types/auth';

const router = Router();
const auth = authenticateJWT as unknown as (req: Request, res: Response, next: NextFunction) => void;
const toAuth = (fn: (r: AuthenticatedRequest, res: Response, next: NextFunction) => void) =>
  (req: Request, res: Response, next: NextFunction) => fn(req as AuthenticatedRequest, res, next);

router.use(auth);
router.post('/start', toAuth(IndexerController.start));
router.get('/status', toAuth(IndexerController.status));
router.get('/history', toAuth(IndexerController.history));

export default router;
