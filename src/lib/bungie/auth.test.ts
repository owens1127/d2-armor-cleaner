import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exchangeBungieCode, parseBungieTokenJson } from './auth';
import { bungieOauthCodeUsedKey } from '@/lib/storage/keys';

vi.stubEnv('VITE_D2_ARMOR_CLEANER_BUNGIE_API_KEY', 'test-api-key');
vi.stubEnv('VITE_D2_ARMOR_CLEANER_BUNGIE_CLIENT_ID', '12345');
vi.stubEnv('VITE_D2_ARMOR_CLEANER_BUNGIE_CLIENT_SECRET', 'test-secret');
vi.stubEnv('VITE_D2_ARMOR_CLEANER_BUNGIE_REDIRECT_URI', 'https://localhost:5173/oauth/callback');

describe('parseBungieTokenJson', () => {
  it('parses flat OAuth2 token response', () => {
    const tokens = parseBungieTokenJson({
      access_token: 'flat-token',
      refresh_token: 'flat-refresh',
      expires_in: 3600,
      membership_id: '123',
    });
    expect(tokens).toEqual({
      access_token: 'flat-token',
      refresh_token: 'flat-refresh',
      expires_in: 3600,
      membership_id: '123',
    });
  });

  it('parses Platform-wrapped Response', () => {
    const tokens = parseBungieTokenJson({
      ErrorCode: 1,
      Response: {
        access_token: 'wrapped-token',
        refresh_token: 'wrapped-refresh',
        expires_in: 7200,
        membership_id: '456',
      },
    });
    expect(tokens.access_token).toBe('wrapped-token');
  });

  it('throws with error_description for OAuth errors', () => {
    expect(() =>
      parseBungieTokenJson({
        error: 'invalid_grant',
        error_description: 'Authorization code expired',
      }),
    ).toThrow(/Authorization code expired/i);
  });

  it('throws when access_token is missing', () => {
    expect(() => parseBungieTokenJson({ ErrorCode: 1 })).toThrow(/missing access_token/i);
  });
});

describe('exchangeBungieCode', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => store.clear(),
    });
    vi.restoreAllMocks();
  });

  it('sends client_secret in body with X-API-Key header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        access_token: 'token',
        refresh_token: 'refresh',
        expires_in: 3600,
        membership_id: '999',
        token_type: 'Bearer',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const tokens = await exchangeBungieCode('auth-code-abc');

    expect(tokens.access_token).toBe('token');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/Platform/App/OAuth/token/');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-API-Key']).toBe('test-api-key');
    expect(headers.Authorization).toBeUndefined();
    const body = init.body as string;
    expect(body).toContain('client_secret=test-secret');
    expect(body).toContain('code=auth-code-abc');
  });

  it('accepts Platform Response wrapper from token endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          ErrorCode: 1,
          Response: {
            access_token: 'wrapped',
            refresh_token: 'r',
            expires_in: 3600,
          },
        }),
      }),
    );

    const tokens = await exchangeBungieCode('code-wrapped');
    expect(tokens.access_token).toBe('wrapped');
  });

  it('rejects reusing the same authorization code', async () => {
    store.set(bungieOauthCodeUsedKey('reuse-me'), '1');
    await expect(exchangeBungieCode('reuse-me')).rejects.toThrow(/already used/i);
  });

  it('surfaces Bungie error_description from token endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          error: 'invalid_client',
          error_description: 'Client authentication failed',
        }),
      }),
    );

    await expect(exchangeBungieCode('bad-code')).rejects.toThrow(/Client authentication failed/i);
    expect(store.get(bungieOauthCodeUsedKey('bad-code'))).toBeUndefined();
  });
});
