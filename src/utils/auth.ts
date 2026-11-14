import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';

export interface TokenPayload {
  userId: string;
  type: 'access' | 'refresh';
  sessionId?: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Hash password
 */
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

/**
 * Compare password with hash
 */
export const comparePassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

/**
 * Generate JWT access token
 */
export const generateAccessToken = (
  payload: Omit<TokenPayload, 'type'>,
  secret: string,
  expiresIn: string
): string => {
  return jwt.sign({ ...payload, type: 'access' }, secret, {
    expiresIn,
  } as jwt.SignOptions);
};

/**
 * Generate JWT refresh token
 */
export const generateRefreshToken = (
  payload: Omit<TokenPayload, 'type'>,
  secret: string,
  expiresIn: string
): string => {
  return jwt.sign({ ...payload, type: 'refresh' }, secret, {
    expiresIn,
  } as jwt.SignOptions);
};

/**
 * Generate email verification token
 */
export const generateEmailVerificationToken = (): string => {
  return randomBytes(32).toString('hex');
};

/**
 * Generate password reset token
 */
export const generatePasswordResetToken = (): string => {
  return randomBytes(32).toString('hex');
};

/**
 * Generate OAuth state parameter
 */
export const generateOAuthState = (): string => {
  return randomBytes(32).toString('hex');
};

/**
 * Verify JWT token
 */
export const verifyToken = (
  token: string,
  secret: string
): TokenPayload => {
  try {
    return jwt.verify(token, secret) as TokenPayload;
  } catch (error) {
    throw new Error('Invalid token');
  }
};