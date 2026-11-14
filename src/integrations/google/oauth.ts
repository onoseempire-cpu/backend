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

  for (const [k, v] of stateCache) {
    if (v.expiresAt < Date.now()) stateCache.delete(k);
  }

  const client = getClientForProvider(provider);

  return client.generateAuthUrl({
    access_type: 'offline',
    scope: [...OAUTH_SCOPES[provider]],
    state,
    prompt: 'consent',
  });
};

// ── OAuth State Validator ───────────────────────────────────────────────────
export const validateState = (state: string): { userId: string; provider: IntegrationProvider } => {
  const cached = stateCache.get(state);
  if (!cached) throw new Error('INVALID_STATE');
  if (cached.expiresAt < Date.now()) { stateCache.delete(state); throw new Error('STATE_EXPIRED'); }
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
    throw new Error('OAUTH_ERROR');
  }

  if (!tokens?.access_token) throw new Error('OAUTH_NO_TOKEN');
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data: userInfo } = await oauth2.userinfo.get();

  const providerAccountId = userInfo.id ?? userInfo.email ?? 'unknown';
  const displayName = userInfo.name ?? null;

  const account = await prisma.connectedAccount.upsert({
    where: { userId_provider_providerAccountId: { userId, provider: provider.toUpperCase(), providerAccountId } },
    create: { userId, provider: provider.toUpperCase(), providerAccountId, displayName, email: userInfo.email ?? null, profileImageUrl: userInfo.picture ?? null, status: 'active' },
    update: { displayName: displayName ?? undefined, email: userInfo.email ?? undefined, profileImageUrl: userInfo.picture ?? undefined, status: 'active', errorMessage: null },
  });

  const enc = { accessToken: tokens.access_token, refreshToken: tokens.refresh_token ?? null, idToken: tokens.id_token ?? null };

  await prisma.oAuthCredential.upsert({
    where: { connectedAccountId: account.id },
    create: { connectedAccountId: account.id, userId, accessToken: enc.accessToken, refreshToken: enc.refreshToken ?? '', idToken: enc.idToken, expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null, scope: JSON.stringify(tokens.scope?.split(' ') ?? []) },
    update: { accessToken: enc.accessToken, refreshToken: enc.refreshToken ?? undefined, idToken: enc.idToken ?? undefined, expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined, scope: JSON.stringify(tokens.scope?.split(' ') ?? []) },
  });

  return { accountId: account.id, displayName };
};

export const getAuthenticatedClient = async (connectedAccountId: string) => {
  const credential = await prisma.oAuthCredential.findUnique({ where: { connectedAccountId }, include: { connectedAccount: true } });
  if (!credential) throw new Error('NO_CREDENTIALS');

  const dec = { accessToken: credential.accessToken, refreshToken: credential.refreshToken, idToken: credential.idToken };
  if (!dec.accessToken) throw new Error('TOKEN_INVALID');

  const provider = credential.connectedAccount.provider as IntegrationProvider;
  const client = getClientForProvider(provider);
  client.setCredentials({ access_token: dec.accessToken, refresh_token: dec.refreshToken ?? undefined, id_token: dec.idToken ?? undefined, expiry_date: credential.expiresAt?.getTime() });

  client.on('tokens', async (newTokens) => {
    if (newTokens.access_token) {
      await prisma.oAuthCredential.update({ where: { connectedAccountId }, data: { accessToken: newTokens.access_token, expiresAt: newTokens.expiry_date ? new Date(newTokens.expiry_date) : undefined } });
    }
  });
  return client;
};

export const disconnectAccount = async (userId: string, accountId: string): Promise<void> => {
  const account = await prisma.connectedAccount.findFirst({ where: { id: accountId, userId } });
  if (!account) throw new Error('NOT_FOUND');

  try {
    const credential = await prisma.oAuthCredential.findUnique({ where: { connectedAccountId: accountId } });
    if (credential?.accessToken) {
      const client = (await import('../../config/oauth')).createYouTubeDataClient();
      client.setCredentials({ access_token: credential.accessToken });
      await client.revokeCredentials().catch(() => {});
    }
  } catch {}

  await prisma.connectedAccount.update({ where: { id: accountId }, data: { status: 'disconnected', lastSyncAt: null } });
};

export type { IntegrationProvider };
