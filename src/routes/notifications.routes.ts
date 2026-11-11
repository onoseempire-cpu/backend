import { Router, Request, Response, NextFunction } from 'express';
import { NotificationsController } from '../controllers/notifications.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../types/auth';

const router = Router();
const auth = authenticateJWT as unknown as (req: Request, res: Response, next: NextFunction) => void;
const toAuth = (fn: (r: AuthenticatedRequest, res: Response, next: NextFunction) => void) =>
  (req: Request, res: Response, next: NextFunction) => fn(req as AuthenticatedRequest, res, next);

router.use(auth);
router.get('/', toAuth(NotificationsController.getAll));
router.get('/unread', toAuth(NotificationsController.getUnread));
router.patch('/:notificationId/read', toAuth(NotificationsController.markRead));
router.post('/read-all', toAuth(NotificationsController.markAllRead));

export default router;
