import { i18n } from '@/i18n';
import { isDevBuild } from '@/lib/env';

export function vaultErrorHintCopy(message: string): string | null {
  const lower = message.toLowerCase();

  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('invalid_grant')) {
    return i18n.t('errors:vault.sessionExpired');
  }
  if (lower.includes('403') || lower.includes('forbidden')) {
    return i18n.t('errors:vault.forbidden');
  }
  if (lower.includes('manifest')) {
    return i18n.t('errors:vault.manifest');
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('failed to fetch')) {
    return i18n.t('errors:vault.network');
  }
  if (lower.includes('membership') || lower.includes('destiny account')) {
    return i18n.t('errors:vault.membership');
  }

  return null;
}

export function bungieSignInUnavailableMessageCopy(): string {
  return isDevBuild()
    ? i18n.t('errors:env.bungieSignInUnavailableDev')
    : i18n.t('errors:env.bungieSignInUnavailable');
}

export function bungieCredentialsMissingMessageCopy(): string {
  return isDevBuild()
    ? i18n.t('errors:env.bungieCredentialsMissingDev')
    : i18n.t('errors:env.bungieCredentialsMissing');
}

export function bungieClientSecretMissingMessageCopy(): string {
  return isDevBuild()
    ? i18n.t('errors:env.bungieSecretMissingDev')
    : bungieCredentialsMissingMessageCopy();
}

export function dimSyncUnavailableMessageCopy(): string {
  return isDevBuild()
    ? i18n.t('errors:env.dimSyncUnavailableDev')
    : i18n.t('errors:env.dimSyncUnavailable');
}

export function oauthFailureSuffixCopy(): string {
  if (isDevBuild()) return '';
  return i18n.t('errors:oauth.suffix');
}

export function oauthFailureDevChecklistCopy(
  redirectUri: string,
  clientId: string | undefined,
): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return (
    `\n\n${i18n.t('errors:oauth.devChecklistIntro')}\n` +
    `• ${i18n.t('errors:oauth.devRedirect', { uri: redirectUri })}\n` +
    `• ${i18n.t('errors:oauth.devOrigin', { origin })}\n` +
    `• ${i18n.t('errors:oauth.devClientId', { clientId: clientId ?? 'unknown' })}\n` +
    `• ${i18n.t('errors:oauth.devApiKey')}\n` +
    `• ${i18n.t('errors:oauth.devRestart')}`
  );
}
