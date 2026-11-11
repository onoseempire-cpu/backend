import crypto from 'crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY = Buffer.from(env.ENCRYPTION_KEY, 'utf-8'); // 32 bytes

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns: iv:authTag:encryptedData (all hex encoded)
 */
export const encrypt = (plaintext: string): string => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

/**
 * Decrypt an AES-256-GCM encrypted string.
 */
export const decrypt = (encryptedText: string): string => {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted text format');

  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};

/**
 * Hash a value using SHA-256 (for checksums, not passwords)
 */
export const sha256 = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex');

/**
 * Generate a secure random token
 */
export const generateSecureToken = (bytes = 32): string =>
  crypto.randomBytes(bytes).toString('hex');
