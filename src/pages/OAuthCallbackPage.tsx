import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { exchangeBungieCode, getBungieConfig, storeBungieTokens } from '@/lib/bungie/auth';
import { isDevBuild, oauthFailureDevChecklist, oauthFailureSuffix } from '@/lib/env';
import { getBungieAccessToken } from '@/lib/bungie/client';
import { SS_BUNGIE_OAUTH_STATE } from '@/lib/storage/keys';
import { getOnboardingResumePath, isOnboardingComplete } from '@/lib/onboarding/storage';
import { i18n } from '@/i18n';
import { useVaultStore } from '@/stores';

type OAuthDestination =
  | '/dashboard/hunter'
  | '/onboarding/rules'
  | '/onboarding/inventory'
  | '/onboarding/calibrate';

type OAuthCallbackResult =
  | { ok: true; destination: OAuthDestination }
  | { ok: false; error: string };

const callbackInflight = new Map<string, Promise<OAuthCallbackResult>>();

function completeOAuthCallback(
  code: string,
  state: string | null,
  savedState: string | null,
  loadLiveVault: () => Promise<void>,
  onboardingComplete: boolean,
): Promise<OAuthCallbackResult> {
  const existing = callbackInflight.get(code);
  if (existing) return existing;

  const task = (async (): Promise<OAuthCallbackResult> => {
    if (!savedState || state !== savedState) {
      return {
        ok: false,
        error: i18n.t('errors:oauth.stateMismatch'),
      };
    }

    const token = await exchangeBungieCode(code);
    storeBungieTokens(token);
    sessionStorage.removeItem(SS_BUNGIE_OAUTH_STATE);

    await loadLiveVault();
    return {
      ok: true,
      destination: getOnboardingResumePath(onboardingComplete) as OAuthDestination,
    };
  })().finally(() => {
    callbackInflight.delete(code);
  });

  callbackInflight.set(code, task);
  return task;
}

export function OAuthCallbackPage() {
  const { t } = useTranslation(['errors', 'common']);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { loadLiveVault } = useVaultStore();
  const [status, setStatus] = useState(() => t('errors:oauth.completingLogin'));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get('code');
    const state = params.get('state');
    const oauthError = params.get('error');
    const saved = sessionStorage.getItem(SS_BUNGIE_OAUTH_STATE);
    const resumePath = getOnboardingResumePath(isOnboardingComplete());

    if (oauthError) {
      setError(t('errors:oauth.bungieDenied', { error: oauthError }));
      return;
    }
    if (!code) {
      setError(t('errors:oauth.noAuthCode'));
      return;
    }

    if (getBungieAccessToken()) {
      navigate(resumePath, { replace: true });
      return;
    }

    setStatus(t('errors:oauth.exchangingCode'));

    completeOAuthCallback(code, state, saved, loadLiveVault, isOnboardingComplete())
      .then((result) => {
        if (result.ok) {
          setStatus(t('errors:oauth.loadingVault'));
          navigate(result.destination, { replace: true });
          return;
        }
        setError(result.error);
      })
      .catch((e) => {
        console.error('[oauth]', e);
        const msg = e instanceof Error ? e.message : t('errors:oauth.loginFailed');
        const { redirectUri, clientId } = getBungieConfig();
        setError(
          msg +
            oauthFailureSuffix() +
            (isDevBuild() ? oauthFailureDevChecklist(redirectUri, clientId) : ''),
        );
      });
  }, [params, navigate, loadLiveVault, t]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 gap-4">
        <p className="text-danger max-w-md whitespace-pre-line text-sm">{error}</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded-lg border border-border hover:bg-white/5 text-sm"
        >
          {t('errors:oauth.backToLogin')}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-muted gap-2">
      <p>{status}</p>
      <p className="text-xs opacity-60">{t('errors:oauth.firstLoadNote')}</p>
    </div>
  );
}
