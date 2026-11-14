import { Router, Request, Response, NextFunction } from 'express';
import { AuthController } from '../controllers';
import { authenticateJWT } from '../middleware/auth.middleware';
import { authRateLimit } from '../middleware/rate-limit';
import { auditLog } from '../middleware/audit';

const router = Router();

const toAuth = (fn: (r: Request, res: Response, next: NextFunction) => void) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next);

router.post('/register', authRateLimit, auditLog('user.register') as never, toAuth(AuthController.register as any));
router.post('/login', authRateLimit, auditLog('user.login') as never, toAuth(AuthController.login as any));
router.post('/logout', toAuth(AuthController.logout as any));
router.post('/refresh', toAuth(AuthController.refresh as any));
router.get('/me', authenticateJWT as never, toAuth(AuthController.me as any));
router.post('/password-reset/request', authRateLimit, toAuth(AuthController.requestPasswordReset as any));
router.post('/password-reset/confirm', authRateLimit, toAuth(AuthController.resetPassword as any));
router.get('/verify-email', toAuth(AuthController.verifyEmail as any));

export default router;