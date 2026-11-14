import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { sendError } from '../utils/api-response';
import { AppError } from '../middleware/error-handler';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { UserProfile } from '../types/api';

export class AuthController {
  /**
   * User registration
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, name } = req.body as { email: string; password: string; name?: string };

      if (!email || !password) {
        sendError(res, 400, 'VALIDATION_ERROR', 'Email and password are required');
        return;
      }

      const result = await AuthService.register(email, password, name);

      const response: UserProfile & { accessToken: string; refreshToken: string; expiresIn: number } = {
        id: result.user.id,
        email: result.user.email,
        displayName: result.user.displayName,
        avatarUrl: result.user.avatarUrl,
        role: result.user.role,
        emailVerified: result.user.emailVerified,
        createdAt: result.user.createdAt,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: 900,
      };

      res.status(201).json({
        success: true,
        data: response,
      });
    } catch (error) {
      if (error instanceof AppError) {
        sendError(res, error.statusCode, error.code, error.message);
        return;
      }
      sendError(res, 500, 'REGISTRATION_FAILED', 'Failed to register user');
    }
  }

  /**
   * User login
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body as { email: string; password: string };

      if (!email || !password) {
        sendError(res, 400, 'VALIDATION_ERROR', 'Email and password are required');
        return;
      }

      const result = await AuthService.login(
        email,
        password,
        req.ip,
        req.get('User-Agent')
      );

      res.json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        sendError(res, error.statusCode, error.code, error.message);
        return;
      }
      sendError(res, 500, 'LOGIN_FAILED', 'Login failed');
    }
  }

  /**
   * Token refresh
   */
  static async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body as { refreshToken: string };

      if (!refreshToken) {
        sendError(res, 400, 'VALIDATION_ERROR', 'Refresh token is required');
        return;
      }

      const result = await AuthService.refreshTokens(refreshToken);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof AppError) {
        sendError(res, error.statusCode, error.code, error.message);
        return;
      }
      sendError(res, 401, 'TOKEN_REFRESH_FAILED', 'Failed to refresh token');
    }
  }

  /**
   * User logout
   */
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body as { refreshToken: string };

      if (!refreshToken) {
        sendError(res, 400, 'VALIDATION_ERROR', 'Refresh token is required');
        return;
      }

      await AuthService.logout(refreshToken);

      res.json({
        success: true,
        data: null,
      });
    } catch (error) {
      if (error instanceof AppError) {
        sendError(res, error.statusCode, error.code, error.message);
        return;
      }
      sendError(res, 500, 'LOGOUT_FAILED', 'Logout failed');
    }
  }

  /**
   * Get current user
   */
  static async me(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 401, 'UNAUTHORIZED', 'Not authenticated');
        return;
      }

      const user = await AuthService.getMe(req.user.id);

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      if (error instanceof AppError) {
        sendError(res, error.statusCode, error.code, error.message);
        return;
      }
      sendError(res, 500, 'FETCH_FAILED', 'Failed to fetch user data');
    }
  }

  /**
   * Request password reset
   */
  static async requestPasswordReset(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body as { email: string };

      if (!email) {
        sendError(res, 400, 'VALIDATION_ERROR', 'Email is required');
        return;
      }

      await AuthService.requestPasswordReset(email);

      res.json({
        success: true,
        message: 'If the email exists, a password reset link has been sent',
      });
    } catch (error) {
      if (error instanceof AppError) {
        sendError(res, error.statusCode, error.code, error.message);
        return;
      }
      sendError(res, 500, 'PASSWORD_RESET_REQUEST_FAILED', 'Failed to request password reset');
    }
  }

  /**
   * Confirm password reset
   */
  static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, password } = req.body as { token: string; password: string };

      if (!token || !password) {
        sendError(res, 400, 'VALIDATION_ERROR', 'Token and password are required');
        return;
      }

      await AuthService.resetPassword(token, password);

      res.json({
        success: true,
        message: 'Password has been reset successfully',
      });
    } catch (error) {
      if (error instanceof AppError) {
        sendError(res, error.statusCode, error.code, error.message);
        return;
      }
      sendError(res, 500, 'PASSWORD_RESET_FAILED', 'Failed to reset password');
    }
  }

  /**
   * Verify email
   */
  static async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.query as { token: string };

      if (!token) {
        sendError(res, 400, 'VALIDATION_ERROR', 'Verification token is required');
        return;
      }

      await AuthService.verifyEmail(token);

      res.json({
        success: true,
        message: 'Email has been verified successfully',
      });
    } catch (error) {
      if (error instanceof AppError) {
        sendError(res, error.statusCode, error.code, error.message);
        return;
      }
      sendError(res, 500, 'EMAIL_VERIFICATION_FAILED', 'Failed to verify email');
    }
  }
}