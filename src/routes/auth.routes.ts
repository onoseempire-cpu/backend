import { Router, Request, Response, NextFunction } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { authRateLimit } from '../middleware/rate-limit';
import { auditLog } from '../middleware/audit';

const router = Router();

router.post('/register', authRateLimit, auditLog('user.register') as never, AuthController.register as never);
router.post('/login', authRateLimit, auditLog('user.login') as never, AuthController.login as never);
router.post('/logout', AuthController.logout as never);
router.post('/refresh', AuthController.refresh as never);
router.get('/me', authenticateJWT as never, AuthController.me as never);
router.post('/password-reset/request', authRateLimit, AuthController.requestPasswordReset as never);
router.post('/password-reset/confirm', authRateLimit, AuthController.resetPassword as never);
router.get('/verify-email', AuthController.verifyEmail as never);

export default router;
