import { google } from 'googleapis';
import prisma from '../../config/database';
import {
  createYouTubeDataClient, createYouTubeAnalyticsClient,
  createYouTubeReportingClient, createAdSenseClient,
  createGoogleAnalyticsClient, createSearchConsoleClient,
  OAUTH_SCOPES,
} from '../../config/oauth';
import { EncryptionService } from '../../services/encryption.service';
import { NotificationService } from '../../services/notification.service';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';
import crypto from 'crypto';

export type IntegrationProvider =
  | 'youtube-data' | 'youtube-analytics' | 'youtube-reporting'
  | 'adsense' | 'google-analytics' | 'search-console';

// In-memory CSRF state store (per machine, single process)
const stateCache = new Map<string, { userId: string; provider: IntegrationProvider; expiresAt: number }>();

export const generateAuthUrl = (userId: string, provider: IntegrationProvider): string => {
  const state = crypto.randomBytes(16).toString('hex');
  stateCache.set(state, { userId, provider, expiresAt: Date.now() + 10 * 60 * 1000 });
  for (const [k, v] of stateCache) if (v.expiresAt < Date.now()) stateCache.delete(k);

  const scopeMap: Record<IntegrationProvider, readonly string[]> = {
    'youtube-data': OAUTH_SCOPES.youtubeData,
    'youtube-analytics': OAUTH_SCOPES.youtubeAnalytics,
    'youtube-reporting': OAUTH_SCOPES.youtubeReporting,
    'adsense': OAUTH_SCOPES.adSense,
    'google-analytics': OAUTH_SCOPES.googleAnalytics,
    'search-console': OAUTH_SCOPES.searchConsole,
  };

  const clientMap: Record<IntegrationProvider, ReturnType<typeof createYouTubeDataClient>> = {
    'youtube-data': createYouTubeDataClient(),
    'youtube-analytics': createYouTubeAnalyticsClient(),
    'youtube-reporting': createYouTubeReportingClient(),
    'adsense': createAdSenseClient(),
    'google-analytics': createGoogleAnalyticsClient(),
    'search-console': createSearchConsoleClient(),
  };

  return clientMap[provider].generateAuthUrl({
    access_type: 'offline', scope: scopeMap[provider] as string[],
    state, prompt: 'consent',
  });
};

export const validateState = (state: string): { userId: string; provider: IntegrationProvider } => {
  const cached = stateCache.get(state);
  if (!cached) throw new AppError(400, 'INVALID_STATE', 'OAuth state is invalid or expired');
  if (cached.expiresAt < Date.now()) {
    stateCache.delete(state);
    throw new AppError(400, 'STATE_EXPIRED', 'OAuth state expired, try connecting again');
  }
  stateCache.delete(state);
  return { userId: cached.userId, provider: cached.provider };
};

export const handleOAuthCallback = async (
  code: string, state: string
): Promise<{ accountId: string; displayName: string | null }> => {
  const { userId, provider } = validateState(state);

  const clientMap: Record<IntegrationProvider, ReturnType<typeof createYouTubeDataClient>> = {
    'youtube-data': createYouTubeDataClient(),
    'youtube-analytics': createYouTubeAnalyticsClient(),
    'youtube-reporting': createYouTubeReportingClient(),
    'adsense': createAdSenseClient(),
    'google-analytics': createGoogleAnalyticsClient(),
    'search-console': createSearchConsoleClient(),
  };

  const client = clientMap[provider];
  let tokens;
  try {
    const result = await client.getToken(code);
    tokens = result.tokens;
    client.setCredentials(tokens);
  } catch (err) {
    logger.error('OAuth token exchange failed', { error: err, provider });
    throw new AppError(500, 'OAUTH_ERROR', 'Failed to exchange authorization code');
  }

  if (!tokens?.access_token) throw new AppError(500, 'OAUTH_NO_TOKEN', 'No access token received');

  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data: userInfo } = await oauth2.userinfo.get();

  const providerAccountId = userInfo.id ?? userInfo.email ?? 'unknown';
  const displayName = userInfo.name ?? null;

  const account = await prisma.connectedAccount.upsert({
    where: { userId_provider_providerAccountId: { userId, provider, providerAccountId } },
    create: { userId, provider, providerAccountId, displayName, email: userInfo.email ?? null, profileImageUrl: userInfo.picture ?? null, status: 'active' },
    update: { displayName: displayName ?? undefined, email: userInfo.email ?? undefined, profileImageUrl: userInfo.picture ?? undefined, status: 'active', errorMessage: null },
  });

  const enc = EncryptionService.encryptTokens({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    idToken: tokens.id_token ?? null,
  });

  await prisma.oAuthCredential.upsert({
    where: { connectedAccountId: account.id },
    create: { connectedAccountId: account.id, accessToken: enc.accessToken, refreshToken: enc.refreshToken ?? '', idToken: enc.idToken, expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null, scopes: JSON.stringify(tokens.scope?.split(' ') ?? []) },
    update: { accessToken: enc.accessToken, refreshToken: enc.refreshToken ?? undefined, idToken: enc.idToken ?? undefined, expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined, scopes: JSON.stringify(tokens.scope?.split(' ') ?? []) },
  });

  logger.info('OAuth account connected', { userId, provider, providerAccountId });
  await NotificationService.create(userId, 'success', `${provider} Connected`, `Account ${userInfo.email ?? providerAccountId} connected.`);
  return { accountId: account.id, displayName };
};

export const getAuthenticatedClient = async (connectedAccountId: string) => {
  const credential = await prisma.oAuthCredential.findUnique({
    where: { connectedAccountId },
    include: { connectedAccount: true },
  });
  if (!credential) throw new AppError(404, 'NO_CREDENTIALS', 'No OAuth credentials found');

  const dec = EncryptionService.decryptTokens({
    accessToken: credential.accessToken,
    refreshToken: credential.refreshToken,
    idToken: credential.idToken,
  });

  const provider = credential.connectedAccount.provider as IntegrationProvider;
  const clientMap: Record<IntegrationProvider, ReturnType<typeof createYouTubeDataClient>> = {
    'youtube-data': createYouTubeDataClient(),
    'youtube-analytics': createYouTubeAnalyticsClient(),
    'youtube-reporting': createYouTubeReportingClient(),
    'adsense': createAdSenseClient(),
    'google-analytics': createGoogleAnalyticsClient(),
    'search-console': createSearchConsoleClient(),
  };

  const client = clientMap[provider];
  client.setCredentials({
    access_token: dec.accessToken,
    refresh_token: dec.refreshToken ?? undefined,
    id_token: dec.idToken ?? undefined,
    expiry_date: credential.expiresAt?.getTime(),
  });

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

export const disconnectAccount = async (userId: string, accountId: string): Promise<void> => {
  const account = await prisma.connectedAccount.findFirst({
    where: { id: accountId, userId },
  });
  if (!account) throw new AppError(404, 'NOT_FOUND', 'Account not found');

  // Try to revoke the OAuth token (best effort)
  try {
    const credential = await prisma.oAuthCredential.findUnique({ where: { connectedAccountId: accountId } });
    if (credential?.accessToken) {
      const dec = EncryptionService.decryptToken(credential.accessToken);
      if (dec) { const c = createYouTubeDataClient(); c.setCredentials({ access_token: dec }); await c.revokeCredentials(); }
    }
  } catch { /* Best effort — don't block disconnect if revoke fails */ }

  await prisma.connectedAccount.update({ where: { id: accountId }, data: { status: 'disconnected' } });
  logger.info('Account disconnected', { userId, accountId });
};
