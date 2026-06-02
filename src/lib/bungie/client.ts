import { getBungieConfig, refreshBungieAccessToken } from './auth';
import { getBungieAuthItem } from '@/lib/bungie/authStorage';
import { SS_BUNGIE_EXPIRES, SS_BUNGIE_REFRESH, SS_BUNGIE_TOKEN } from '@/lib/storage/keys';

export class BungieApiError extends Error {
  constructor(
    message: string,
    public errorCode?: number,
  ) {
    super(message);
  }
}

export function getBungieAccessToken(): string | null {
  return getBungieAuthItem(SS_BUNGIE_TOKEN);
}

function tokenExpiresSoon(): boolean {
  const raw = getBungieAuthItem(SS_BUNGIE_EXPIRES);
  if (!raw) return false;
  return Date.now() > Number(raw) - 120_000;
}

async function ensureAccessToken(): Promise<string | null> {
  const token = getBungieAccessToken();
  if (!token) return null;
  if (!tokenExpiresSoon()) return token;
  try {
    return await refreshBungieAccessToken();
  } catch {
    return token;
  }
}

export async function bungieFetch<T>(
  path: string,
  options: RequestInit = {},
  retried = false,
): Promise<T> {
  const { apiKey } = getBungieConfig();
  const token = await ensureAccessToken();
  const headers: Record<string, string> = {
    'X-API-Key': apiKey ?? '',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://www.bungie.net${path}`, {
    ...options,
    headers,
  });
  const json = await res.json();
  if (json.ErrorCode !== 1) {
    const authErrors = new Set([2108, 99, 1901]);
    if (
      !retried &&
      authErrors.has(json.ErrorCode) &&
      getBungieAuthItem(SS_BUNGIE_REFRESH)
    ) {
      await refreshBungieAccessToken();
      return bungieFetch<T>(path, options, true);
    }
    throw new BungieApiError(json.Message ?? `Bungie API error ${json.ErrorCode}`, json.ErrorCode);
  }
  return json.Response as T;
}
