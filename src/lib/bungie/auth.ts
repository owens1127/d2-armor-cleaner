const BUNGIE_AUTH_URL = 'https://www.bungie.net/en/OAuth/Authorize';
const BUNGIE_TOKEN_URL = 'https://www.bungie.net/Platform/App/OAuth/token/';

import {
  BUNGIE_CLIENT_SECRET_ENV,
  getBungieApiKey,
  getBungieClientId,
  getBungieClientSecret,
  getBungieRedirectUri,
} from '@/lib/env';
import { setBungieAuthItem, getBungieAuthItem } from '@/lib/bungie/authStorage';
import {
  SS_BUNGIE_EXPIRES,
  SS_BUNGIE_OAUTH_CODE_USED,
  SS_BUNGIE_OAUTH_STATE,
  SS_BUNGIE_REFRESH,
  SS_BUNGIE_TOKEN,
  bungieOauthCodeUsedKey,
} from '@/lib/storage/keys';

export function getBungieConfig() {
  return {
    apiKey: getBungieApiKey(),
    clientId: getBungieClientId(),
    redirectUri:
      getBungieRedirectUri() ?? `${window.location.origin}/oauth/callback`,
  };
}

export function isBungieConfigured(): boolean {
  const { apiKey, clientId } = getBungieConfig();
  return Boolean(apiKey && clientId && getBungieClientSecret());
}

function oauthErrorMessage(json: {
  ErrorCode?: number;
  Message?: string;
  ErrorStatus?: string;
  error?: string;
  error_description?: string;
}): string {
  const parts: string[] = [];
  if (json.Message?.trim()) parts.push(json.Message.trim());
  else if (json.error_description?.trim()) parts.push(json.error_description.trim());
  else if (json.error?.trim()) parts.push(json.error.trim());
  else if (json.ErrorStatus?.trim()) parts.push(json.ErrorStatus.trim());

  const code = json.ErrorCode;
  if (code === 2108 || json.error === 'invalid_grant') {
    parts.push('Invalid or expired authorization code: sign in again.');
  } else if (code === 2106) parts.push('Invalid API key: use the key from the same Bungie application.');
  else if (code === 99) parts.push('Bungie session expired: try again.');
  else if (code && code !== 1 && parts.length === 0) parts.push(`Bungie error code ${code}`);

  if (code && code !== 1) parts.push(`(ErrorCode ${code})`);
  return parts.join(' ') || 'OAuth failed';
}

/** Bungie confidential client: secret in body + X-API-Key (browser-friendly). */
function tokenRequestHeaders(apiKey: string): HeadersInit {
  return {
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-API-Key': apiKey,
  };
}

export function startBungieLogin() {
  const { clientId, redirectUri, apiKey } = getBungieConfig();
  const clientSecret = getBungieClientSecret();
  if (!clientId || !apiKey) {
    throw new Error('Bungie API key and client ID are required in .env');
  }
  if (!clientSecret) {
    throw new Error(`${BUNGIE_CLIENT_SECRET_ENV} is required for confidential OAuth clients`);
  }
  const state = crypto.randomUUID();
  sessionStorage.setItem(SS_BUNGIE_OAUTH_STATE, state);
  sessionStorage.removeItem(SS_BUNGIE_OAUTH_CODE_USED);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    state,
    redirect_uri: redirectUri,
  });
  window.location.href = `${BUNGIE_AUTH_URL}?${params.toString()}`;
}

export type BungieTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  membership_id?: string;
};

type BungieTokenJson = {
  ErrorCode?: number;
  Message?: string;
  ErrorStatus?: string;
  Response?: BungieTokenResponse | null;
  error?: string;
  error_description?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  membership_id?: string;
};

/** OAuth token endpoint returns flat OAuth2 JSON; some paths may use Platform { Response }. */
export function parseBungieTokenJson(json: BungieTokenJson, devLabel?: string): BungieTokenResponse {
  if (json.error || (json.ErrorCode !== undefined && json.ErrorCode !== 1)) {
    throw new Error(oauthErrorMessage(json));
  }

  const wrapped = json.Response;
  if (wrapped && typeof wrapped === 'object' && wrapped.access_token) {
    return wrapped;
  }

  if (json.access_token) {
    return {
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      expires_in: json.expires_in,
      membership_id: json.membership_id,
    };
  }

  if (import.meta.env.DEV) {
    console.warn('[oauth] token response missing access_token', {
      label: devLabel,
      keys: Object.keys(json),
      hasResponse: json.Response != null,
      responseType: json.Response === null ? 'null' : typeof json.Response,
    });
  }
  throw new Error('Token response missing access_token');
}

const exchangeInflight = new Map<string, Promise<BungieTokenResponse>>();

async function exchangeBungieCodeOnce(code: string): Promise<BungieTokenResponse> {
  const usedKey = bungieOauthCodeUsedKey(code);
  if (sessionStorage.getItem(usedKey) === '1') {
    throw new Error('Authorization code already used: return to login and sign in again.');
  }
  sessionStorage.setItem(usedKey, 'pending');

  const { apiKey, clientId, redirectUri } = getBungieConfig();
  const clientSecret = getBungieClientSecret();
  if (!apiKey || !clientId || !clientSecret) {
    sessionStorage.removeItem(usedKey);
    throw new Error('Missing Bungie OAuth credentials in .env: restart dev server after editing.');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  let json: BungieTokenJson;
  try {
    const res = await fetch(BUNGIE_TOKEN_URL, {
      method: 'POST',
      headers: tokenRequestHeaders(apiKey),
      body: body.toString(),
    });
    json = (await res.json()) as BungieTokenJson;
    if (import.meta.env.DEV) {
      console.info('[oauth] token response', {
        status: res.status,
        ErrorCode: json.ErrorCode,
        error: json.error,
        hasAccessToken: Boolean(json.access_token ?? json.Response?.access_token),
      });
    }
  } catch (e) {
    sessionStorage.removeItem(usedKey);
    throw e;
  }

  try {
    const tokens = parseBungieTokenJson(json, 'authorization_code');
    sessionStorage.setItem(usedKey, '1');
    return tokens;
  } catch (e) {
    sessionStorage.removeItem(usedKey);
    throw e;
  }
}

/** Deduped across React StrictMode remounts: one token exchange per authorization code. */
export function exchangeBungieCode(code: string): Promise<BungieTokenResponse> {
  const existing = exchangeInflight.get(code);
  if (existing) return existing;

  const task = exchangeBungieCodeOnce(code).finally(() => {
    exchangeInflight.delete(code);
  });
  exchangeInflight.set(code, task);
  return task;
}

export function storeBungieTokens(response: {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}): void {
  if (!response?.access_token) {
    throw new Error('Cannot store tokens: missing access_token');
  }
  setBungieAuthItem(SS_BUNGIE_TOKEN, response.access_token);
  if (response.refresh_token) {
    setBungieAuthItem(SS_BUNGIE_REFRESH, response.refresh_token);
  }
  if (response.expires_in) {
    const expiresAt = Date.now() + response.expires_in * 1000;
    setBungieAuthItem(SS_BUNGIE_EXPIRES, String(expiresAt));
  }
}

export async function refreshBungieAccessToken(): Promise<string> {
  const refreshToken = getBungieAuthItem(SS_BUNGIE_REFRESH);
  if (!refreshToken) throw new Error('No refresh token: sign in again');

  const { apiKey, clientId } = getBungieConfig();
  const clientSecret = getBungieClientSecret();
  if (!apiKey || !clientId || !clientSecret) {
    throw new Error('Missing Bungie OAuth credentials in .env');
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(BUNGIE_TOKEN_URL, {
    method: 'POST',
    headers: tokenRequestHeaders(apiKey),
    body: body.toString(),
  });
  const json = (await res.json()) as BungieTokenJson;
  const tokens = parseBungieTokenJson(json, 'refresh_token');
  storeBungieTokens(tokens);
  return tokens.access_token;
}
