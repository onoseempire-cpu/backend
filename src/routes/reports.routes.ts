import { Router, Request, Response, NextFunction } from 'express';
import { ReportsController } from '../controllers/reports.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../types/auth';

const router = Router();
const auth = authenticateJWT as unknown as (req: Request, res: Response, next: NextFunction) => void;
const toAuth = (fn: (r: AuthenticatedRequest, res: Response, next: NextFunction) => void) =>
  (req: Request, res: Response, next: NextFunction) => fn(req as AuthenticatedRequest, res, next);

router.use(auth);
router.get('/', toAuth(ReportsController.getAll));
router.get('/:reportId', toAuth(ReportsController.getById));
router.post('/export', toAuth(ReportsController.export));

export default router;
