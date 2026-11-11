import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';
import { sendSuccess, sendError } from '../utils/api-response';
import type { AuthenticatedRequest } from '../types/auth';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().max(60).optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const ResetRequestSchema = z.object({ email: z.string().email() });
const ResetConfirmSchema = z.object({ token: z.string(), newPassword: z.string().min(8) });
const RefreshSchema = z.object({ refreshToken: z.string() });

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const body = RegisterSchema.parse(req.body);
      const result = await AuthService.register(body.email, body.password, body.displayName);
      res.cookie('refreshToken', result.refreshToken, { httpOnly: true, sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000 });
      sendSuccess(res, { user: result.user, accessToken: result.accessToken }, 201);
    } catch (err) { next(err); }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const body = LoginSchema.parse(req.body);
      const ip = (req.headers['x-forwarded-for'] as string) ?? req.ip;
      const result = await AuthService.login(body.email, body.password, ip, req.headers['user-agent']);
      res.cookie('refreshToken', result.refreshToken, { httpOnly: true, sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000 });
      sendSuccess(res, { user: result.user, accessToken: result.accessToken });
    } catch (err) { next(err); }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies?.refreshToken || RefreshSchema.parse(req.body).refreshToken;
      await AuthService.logout(token);
      res.clearCookie('refreshToken');
      sendSuccess(res, { message: 'Logged out successfully' });
    } catch (err) { next(err); }
  }

  static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies?.refreshToken || RefreshSchema.parse(req.body).refreshToken;
      const result = await AuthService.refreshTokens(token);
      res.cookie('refreshToken', result.refreshToken, { httpOnly: true, sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000 });
      sendSuccess(res, { accessToken: result.accessToken });
    } catch (err) { next(err); }
  }

  static async me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = await AuthService.getMe(req.user.userId);
      sendSuccess(res, user);
    } catch (err) { next(err); }
  }

  static async requestPasswordReset(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = ResetRequestSchema.parse(req.body);
      await AuthService.requestPasswordReset(email);
      sendSuccess(res, { message: 'If this email is registered, a reset link has been sent.' });
    } catch (err) { next(err); }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, newPassword } = ResetConfirmSchema.parse(req.body);
      await AuthService.resetPassword(token, newPassword);
      sendSuccess(res, { message: 'Password reset successfully. Please log in.' });
    } catch (err) { next(err); }
  }

  static async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.query.token as string;
      if (!token) { sendError(res, 400, 'MISSING_TOKEN', 'Verification token required'); return; }
      await AuthService.verifyEmail(token);
      sendSuccess(res, { message: 'Email verified successfully.' });
    } catch (err) { next(err); }
  }
}
