import type { Page } from '@playwright/test';

const BUNGIE_API_BASE = 'https://www.bungie.net';

/** Session storage keys — must match src/lib/storage/keys.ts */
const SS_BUNGIE_TOKEN = 'dac-bungie-token';
const SS_BUNGIE_REFRESH = 'dac-bungie-refresh-token';
const SS_BUNGIE_EXPIRES = 'dac-bungie-token-expires';
const SS_MEMBERSHIP = 'dac-membership';
const SS_BUNGIE_OAUTH_STATE = 'dac-bungie-oauth-state';

export interface BungieMembership {
  bungieMembershipId: string;
  destinyMembershipId: string;
  membershipType: number;
  displayName: string;
}

export interface BungieSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  membership: BungieMembership;
}

export const E2E_SKIP_MESSAGE =
  'Live E2E skipped: set E2E_BUNGIE_REFRESH_TOKEN in .env (plus VITE_D2_ARMOR_CLEANER_BUNGIE_* keys). ' +
  'Copy refresh token from sessionStorage (dac-bungie-refresh-token) after signing in once locally.';

interface BungieJson {
  ErrorCode?: number;
  Message?: string;
  ErrorStatus?: string;
  Response?: unknown;
}

interface MembershipResponse {
  bungieNetUser: { membershipId: string };
  destinyMemberships: {
    membershipType: number;
    membershipId: string;
    displayName: string;
    bungieGlobalDisplayName?: string;
  }[];
  primaryMembershipId: string | null;
}

function readEnv(primary: string, legacy?: string): string | undefined {
  const value = process.env[primary];
  if (value) return value;
  if (legacy) return process.env[legacy];
  return undefined;
}

function bungieError(json: BungieJson): string {
  return json.Message?.trim() || json.ErrorStatus?.trim() || `Bungie error ${json.ErrorCode ?? 'unknown'}`;
}

export function getE2eBungieEnv() {
  return {
    apiKey: readEnv('VITE_D2_ARMOR_CLEANER_BUNGIE_API_KEY', 'VITE_BUNGIE_API_KEY'),
    clientId: readEnv('VITE_D2_ARMOR_CLEANER_BUNGIE_CLIENT_ID', 'VITE_BUNGIE_CLIENT_ID'),
    clientSecret: readEnv('VITE_D2_ARMOR_CLEANER_BUNGIE_CLIENT_SECRET', 'VITE_BUNGIE_CLIENT_SECRET'),
    refreshToken: process.env.E2E_BUNGIE_REFRESH_TOKEN,
  };
}

export function hasE2eBungieAuth(): boolean {
  const { apiKey, clientId, clientSecret, refreshToken } = getE2eBungieEnv();
  return Boolean(apiKey && clientId && clientSecret && refreshToken);
}

async function bungiePost<T>(path: string, apiKey: string, body: URLSearchParams): Promise<T> {
  const res = await fetch(`${BUNGIE_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-API-Key': apiKey,
    },
    body: body.toString(),
  });
  const json = (await res.json()) as BungieJson;
  if (json.ErrorCode !== 1) throw new Error(bungieError(json));
  return json.Response as T;
}

async function bungieGet<T>(path: string, apiKey: string, accessToken: string): Promise<T> {
  const res = await fetch(`${BUNGIE_API_BASE}${path}`, {
    headers: {
      'X-API-Key': apiKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const json = (await res.json()) as BungieJson;
  if (json.ErrorCode !== 1) throw new Error(bungieError(json));
  return json.Response as T;
}

async function resolveMembership(apiKey: string, accessToken: string): Promise<BungieMembership> {
  const data = await bungieGet<MembershipResponse>(
    '/Platform/User/GetMembershipsForCurrentUser/',
    apiKey,
    accessToken,
  );

  const primary =
    data.destinyMemberships.find((m) => m.membershipId === data.primaryMembershipId) ??
    data.destinyMemberships[0];

  if (!primary) throw new Error('No Destiny 2 membership found on this Bungie account');

  return {
    bungieMembershipId: data.bungieNetUser.membershipId,
    destinyMembershipId: primary.membershipId,
    membershipType: primary.membershipType,
    displayName: primary.bungieGlobalDisplayName ?? primary.displayName ?? 'Guardian',
  };
}

/** Refresh OAuth tokens and resolve Destiny membership (Node-side, no browser). */
export async function createBungieSession(): Promise<BungieSession> {
  const { apiKey, clientId, clientSecret, refreshToken } = getE2eBungieEnv();
  if (!apiKey || !clientId || !clientSecret || !refreshToken) {
    throw new Error(E2E_SKIP_MESSAGE);
  }

  const tokenResponse = await bungiePost<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }>(
    '/Platform/App/OAuth/token/',
    apiKey,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  );

  const expiresAt = tokenResponse.expires_in
    ? Date.now() + tokenResponse.expires_in * 1000
    : Date.now() + 3600_000;

  const membership = await resolveMembership(apiKey, tokenResponse.access_token);

  return {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token ?? refreshToken,
    expiresAt,
    membership,
  };
}

/** Seed localStorage before navigation so AppBootstrap restores a live Bungie session. */
export async function injectBungieSession(page: Page, session: BungieSession): Promise<void> {
  await page.addInitScript((data) => {
    localStorage.setItem('dac-bungie-token', data.accessToken);
    localStorage.setItem('dac-bungie-refresh-token', data.refreshToken);
    localStorage.setItem('dac-bungie-token-expires', String(data.expiresAt));
    localStorage.setItem('dac-membership', JSON.stringify(data.membership));
    sessionStorage.removeItem('dac-bungie-oauth-state');
  }, session);
}
