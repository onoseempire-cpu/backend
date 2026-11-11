import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import prisma from '../config/database';
import { JwtAccessPayload, JwtRefreshPayload } from '../types/auth';

export class TokenService {
  /**
   * Generate a short-lived JWT access token
   */
  static generateAccessToken(payload: Omit<JwtAccessPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    } as jwt.SignOptions);
  }

  /**
   * Generate a secure refresh token and persist it
   */
  static async generateRefreshToken(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ sessionId: string; refreshToken: string }> {
    const sessionId = uuidv4();
    const tokenData: Omit<JwtRefreshPayload, 'iat' | 'exp'> = { userId, sessionId };

    const refreshToken = jwt.sign(tokenData, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    } as jwt.SignOptions);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.session.create({
      data: {
        id: sessionId,
        userId,
        refreshToken,
        expiresAt,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    });

    return { sessionId, refreshToken };
  }

  /**
   * Verify a refresh token and return its payload
   */
  static verifyRefreshToken(token: string): JwtRefreshPayload {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtRefreshPayload;
  }

  /**
   * Invalidate a session
   */
  static async revokeSession(sessionId: string): Promise<void> {
    await prisma.session.updateMany({
      where: { id: sessionId },
      data: { isActive: false },
    });
  }

  /**
   * Invalidate all sessions for a user
   */
  static async revokeAllUserSessions(userId: string): Promise<void> {
    await prisma.session.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });
  }

  /**
   * Clean up expired sessions
   */
  static async cleanExpiredSessions(): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}
