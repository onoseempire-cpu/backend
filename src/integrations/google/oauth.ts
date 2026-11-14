import { google } from 'googleapis';
import prisma from '../../config/database';
import {
  createYouTubeDataClient, createYouTubeAnalyticsClient,
  createYouTubeReportingClient, createAdSenseClient,
  createGoogleAnalyticsClient, createSearchConsoleClient,
  OAUTH_SCOPES, IntegrationProvider, getClientForProvider,
} from '../../config/oauth';
import { EncryptionService } from '../../services/encryption.service';
import { NotificationService } from '../../services/notification.service';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';
import crypto from 'crypto';

// ── In-memory CSRF state store ─────────────────────────────────────────────────
const stateCache = new Map<string, { userId: string; provider: IntegrationProvider; expiresAt: number }>();

// ── OAuth URL Generator ──────────────────────────────────────────────────────
export const generateAuthUrl = (userId: string, provider: IntegrationProvider): string => {
  const state = crypto.randomBytes(16).toString('hex');
  stateCache.set(state, { userId, provider, expiresAt: Date.now() + 10 * 60 * 1000 });

  // Clean up expired states
  for (const [k, v] of stateCache) {
    if (v.expiresAt < Date.now()) stateCache.delete(k);
  }

  const client = getClientForProvider(provider);

  return client.generateAuthUrl({
    access_type: 'offline',
    scope: OAUTH_SCOPES[provider],
    state,
    prompt: 'consent',
  });
};

// ── OAuth State Validator ───────────────────────────────────────────────────
export const validateState = (state: string): { userId: string; provider: IntegrationProvider } => {
  const cached = stateCache.get(state);
  if (!cached) {
    throw new AppError(400, 'INVALID_STATE', 'OAuth state is invalid or expired');
  }
  if (cached.expiresAt < Date.now()) {
    stateCache.delete(state);
    throw new AppError(400, 'STATE_EXPIRED', 'OAuth state expired, try connecting again');
  }
  stateCache.delete(state);
  return { userId: cached.userId, provider: cached.provider };
};

// ── OAuth Callback Handler ─────────────────────────────────────────────────
export const handleOAuthCallback = async (
  code: string,
  state: string
): Promise<{ accountId: string; displayName: string | null }> => {
  const { userId, provider } = validateState(state);

  const client = getClientForProvider(provider);

  let tokens;
  try {
    const result = await client.getToken(code);
    tokens = result.tokens;
    client.setCredentials(tokens);
  } catch (err) {
    logger.error('OAuth token exchange failed', { error: err, provider });
    throw new AppError(500, 'OAUTH_ERROR', 'Failed to exchange authorization code');
  }

  if (!tokens?.access_token) {
    throw new AppError(500, 'OAUTH_NO_TOKEN', 'No access token received');
  }

  client.setCredentials(tokens);

  // Fetch user info from oauth2 API
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data: userInfo } = await oauth2.userinfo.get();

  const providerAccountId = userInfo.id ?? userInfo.email ?? 'unknown';
  const displayName = userInfo.name ?? null;

  // Create or update connected account
  const account = await prisma.connectedAccount.upsert({
    where: {
      userId_provider_providerAccountId: {
        userId,
        provider: provider.toUpperCase() as any,
        providerAccountId,
      },
    },
    create: {
      userId,
      provider: provider.toUpperCase(),
      providerAccountId,
      displayName,
      email: userInfo.email ?? null,
      profileImageUrl: userInfo.picture ?? null,
      status: 'active',
    },
    update: {
      displayName: displayName ?? undefined,
      email: userInfo.email ?? undefined,
      profileImageUrl: userInfo.picture ?? undefined,
      status: 'active',
      errorMessage: null,
    },
  });

  // Store encrypted credentials
  const enc = EncryptionService.encryptTokens({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    idToken: tokens.id_token ?? null,
  });

  await prisma.oAuthCredential.upsert({
    where: { connectedAccountId: account.id },
    create: {
      connectedAccountId: account.id,
      userId,
      accessToken: enc.accessToken,
      refreshToken: enc.refreshToken ?? '',
      idToken: enc.idToken,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scopes: JSON.stringify(tokens.scope?.split(' ') ?? []),
      scope: JSON.stringify(tokens.scope?.split(' ') ?? []),
    },
    update: {
      accessToken: enc.accessToken,
      refreshToken: enc.refreshToken ?? undefined,
      idToken: enc.idToken ?? undefined,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      scopes: JSON.stringify(tokens.scope?.split(' ') ?? []),
      scope: JSON.stringify(tokens.scope?.split(' ') ?? []),
    },
  });

  logger.info('OAuth account connected', { userId, provider, providerAccountId });
  await NotificationService.create(
    userId,
    'success',
    'Connected',
    `${provider} connected successfully.`
  );

  return { accountId: account.id, displayName };
};

// ── Get Authenticated Client ───────────────────────────────────────────────
export const getAuthenticatedClient = async (connectedAccountId: string) => {
  const credential = await prisma.oAuthCredential.findUnique({
    where: { connectedAccountId },
    include: { connectedAccount: true },
  });

  if (!credential) {
    throw new AppError(404, 'NO_CREDENTIALS', 'No OAuth credentials found');
  }

  const dec = EncryptionService.decryptTokens({
    accessToken: credential.accessToken,
    refreshToken: credential.refreshToken,
    idToken: credential.idToken,
  });

  if (!dec.accessToken) {
    throw new AppError(401, 'TOKEN_INVALID', 'No valid access token');
  }

  const provider = credential.connectedAccount.provider as IntegrationProvider;
  const client = getClientForProvider(provider);

  client.setCredentials({
    access_token: dec.accessToken,
    refresh_token: dec.refreshToken ?? undefined,
    id_token: dec.idToken ?? undefined,
    expiry_date: credential.expiresAt?.getTime(),
  });

  // Auto-refresh tokens when they expire
  client.on('tokens', async (newTokens) => {
    if (newTokens.access_token) {
      await prisma.oAuthCredential.update({
        where: { connectedAccountId },
        data: {
          accessToken: EncryptionService.encryptToken(newTokens.access_token)!,
          expiresAt: newTokens.expiry_date ? new Date(newTokens.expiry_date) : undefined,
        },
      });
    }
  });

  return client;
};

// ── Disconnect Account ──────────────────────────────────────────────────────
export const disconnectAccount = async (userId: string, accountId: string): Promise<void> => {
  const account = await prisma.connectedAccount.findFirst({
    where: { id: accountId, userId },
  });

  if (!account) {
    throw new AppError(404, 'NOT_FOUND', 'Account not found');
  }

  // Try to revoke the OAuth token (best effort)
  try {
    const credential = await prisma.oAuthCredential.findUnique({
      where: { connectedAccountId: accountId },
    });

    if (credential?.accessToken) {
      const dec = EncryptionService.decryptToken(credential.accessToken);
      if (dec) {
        const client = createYouTubeDataClient();
        client.setCredentials({ access_token: dec });
        await client.revokeCredentials().catch(() => {
          /* Best effort - don't block disconnect if revoke fails */
        });
      }
    }
  } catch {
    /* Best effort — don't block disconnect if revoke fails */
  }

  await prisma.connectedAccount.update({
    where: { id: accountId },
    data: { status: 'disconnected', lastSyncAt: null },
  });

  logger.info('Account disconnected', { userId, accountId });
};