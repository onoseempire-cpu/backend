import { encrypt, decrypt } from '../utils/encryption';

export class EncryptionService {
  static encryptToken(token: string | null | undefined): string | null {
    if (!token) return null;
    return encrypt(token);
  }

  static decryptToken(encryptedToken: string | null | undefined): string | null {
    if (!encryptedToken) return null;
    try {
      return decrypt(encryptedToken);
    } catch {
      return null;
    }
  }

  static encryptTokens(tokens: {
    accessToken: string;
    refreshToken?: string | null;
    idToken?: string | null;
  }) {
    return {
      accessToken: encrypt(tokens.accessToken),
      refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
      idToken: tokens.idToken ? encrypt(tokens.idToken) : null,
    };
  }

  static decryptTokens(encrypted: {
    accessToken: string;
    refreshToken?: string | null;
    idToken?: string | null;
  }) {
    return {
      accessToken: decrypt(encrypted.accessToken),
      refreshToken: encrypted.refreshToken ? decrypt(encrypted.refreshToken) : null,
      idToken: encrypted.idToken ? decrypt(encrypted.idToken) : null,
    };
  }
}
