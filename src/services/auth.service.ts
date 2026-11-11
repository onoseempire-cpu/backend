import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { TokenService } from './token.service';
import { NotificationService } from './notification.service';
import { generateSecureToken } from '../utils/encryption';
import { AppError } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import type { UserProfile } from '../types/api';

const BCRYPT_ROUNDS = 12;

export class AuthService {
  // ── Registration ───────────────────────────────────────────────────────────
  static async register(
    email: string,
    password: string,
    displayName?: string
  ): Promise<{ user: UserProfile; accessToken: string; refreshToken: string }> {
    // Check existing user
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists');

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const emailVerifyToken = generateSecureToken(32);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: displayName ?? null,
        emailVerifyToken,
      },
    });

    logger.info('User registered', { userId: user.id, email });

    // Welcome notification
    await NotificationService.create(
      user.id,
      'success',
      'Welcome to PMAV!',
      'Your account has been created. Connect your first account to start analyzing.'
    );

    const accessToken = TokenService.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    const { refreshToken } = await TokenService.generateRefreshToken(user.id);

    return { user: AuthService.toUserProfile(user), accessToken, refreshToken };
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  static async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ user: UserProfile; accessToken: string; refreshToken: string }> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    logger.info('User logged in', { userId: user.id, email });

    const accessToken = TokenService.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    const { refreshToken } = await TokenService.generateRefreshToken(
      user.id,
      ipAddress,
      userAgent
    );

    return { user: AuthService.toUserProfile(user), accessToken, refreshToken };
  }

  // ── Token Refresh ──────────────────────────────────────────────────────────
  static async refreshTokens(
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    let payload;
    try {
      payload = TokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError(401, 'TOKEN_INVALID', 'Invalid or expired refresh token');
    }

    const session = await prisma.session.findFirst({
      where: { id: payload.sessionId, refreshToken, isActive: true },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new AppError(401, 'SESSION_EXPIRED', 'Session expired, please log in again');
    }

    // Rotate: revoke old, issue new
    await TokenService.revokeSession(session.id);
    const { refreshToken: newRefresh } = await TokenService.generateRefreshToken(session.userId);
    const newAccess = TokenService.generateAccessToken({
      userId: session.user.id,
      email: session.user.email,
      role: session.user.role,
    });

    return { accessToken: newAccess, refreshToken: newRefresh };
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  static async logout(refreshToken: string): Promise<void> {
    const session = await prisma.session.findUnique({ where: { refreshToken } });
    if (session) await TokenService.revokeSession(session.id);
  }

  // ── Get Current User ───────────────────────────────────────────────────────
  static async getMe(userId: string): Promise<UserProfile> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
    return AuthService.toUserProfile(user);
  }

  // ── Password Reset Request ─────────────────────────────────────────────────
  static async requestPasswordReset(email: string): Promise<{ token: string }> {
    const user = await prisma.user.findUnique({ where: { email } });
    // Always return success to prevent email enumeration
    if (!user) return { token: '' };

    const token = generateSecureToken(32);
    const expires = new Date();
    expires.setHours(expires.getHours() + 1); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpires: expires },
    });

    return { token };
  }

  // ── Password Reset Confirm ─────────────────────────────────────────────────
  static async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) throw new AppError(400, 'TOKEN_INVALID', 'Password reset token is invalid or expired');

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    await TokenService.revokeAllUserSessions(user.id);
    logger.info('Password reset completed', { userId: user.id });
  }

  // ── Verify Email ───────────────────────────────────────────────────────────
  static async verifyEmail(token: string): Promise<void> {
    const user = await prisma.user.findFirst({ where: { emailVerifyToken: token } });
    if (!user) throw new AppError(400, 'TOKEN_INVALID', 'Email verification token is invalid');

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifyToken: null },
    });
  }

  // ── Helper ─────────────────────────────────────────────────────────────────
  static toUserProfile(user: {
    id: string; email: string; displayName: string | null;
    avatarUrl: string | null; role: string; emailVerified: boolean; createdAt: Date;
  }): UserProfile {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
