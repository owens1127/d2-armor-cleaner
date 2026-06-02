function readEnv(primary: string, legacy?: string): string | undefined {
  const value = import.meta.env[primary] as string | undefined;
  if (value) return value;
  if (legacy) return import.meta.env[legacy] as string | undefined;
  return undefined;
}

export function getBungieApiKey(): string | undefined {
  return readEnv('VITE_D2_ARMOR_CLEANER_BUNGIE_API_KEY', 'VITE_BUNGIE_API_KEY');
}

export function getBungieClientId(): string | undefined {
  return readEnv('VITE_D2_ARMOR_CLEANER_BUNGIE_CLIENT_ID', 'VITE_BUNGIE_CLIENT_ID');
}

export function getBungieClientSecret(): string | undefined {
  return readEnv('VITE_D2_ARMOR_CLEANER_BUNGIE_CLIENT_SECRET', 'VITE_BUNGIE_CLIENT_SECRET');
}

export function getBungieRedirectUri(): string | undefined {
  return readEnv('VITE_D2_ARMOR_CLEANER_BUNGIE_REDIRECT_URI', 'VITE_BUNGIE_REDIRECT_URI');
}

export function getDimApiKey(): string | undefined {
  return readEnv('VITE_D2_ARMOR_CLEANER_DIM_API_KEY', 'VITE_DIM_API_KEY');
}

/** @deprecated Internal label only; do not show in UI */
export const BUNGIE_CLIENT_SECRET_ENV =
  'VITE_D2_ARMOR_CLEANER_BUNGIE_CLIENT_SECRET (or legacy VITE_BUNGIE_CLIENT_SECRET)';

/** @deprecated Internal label only; do not show in UI */
export const DIM_API_KEY_ENV =
  'VITE_D2_ARMOR_CLEANER_DIM_API_KEY (or legacy VITE_DIM_API_KEY)';

export function isDevBuild(): boolean {
  return import.meta.env.DEV;
}

/** Home / landing when Bungie OAuth is not wired on this build */
export function bungieSignInUnavailableMessage(): string {
  if (isDevBuild()) {
    return 'Sign-in is not enabled in this build.';
  }
  return 'Sign-in is not available on this deployment.';
}

/** Thrown when sign-in or token exchange runs without full Bungie credentials */
export function bungieCredentialsMissingMessage(): string {
  if (isDevBuild()) {
    return 'Bungie sign-in is not enabled in this environment.';
  }
  return 'Sign-in is not available on this deployment. Contact the site administrator.';
}

export function bungieClientSecretMissingMessage(): string {
  if (isDevBuild()) {
    return 'Bungie sign-in is not fully enabled in this environment.';
  }
  return bungieCredentialsMissingMessage();
}

export function dimSyncUnavailableMessage(): string {
  if (isDevBuild()) {
    return 'DIM sync is not enabled in this environment.';
  }
  return 'Applying tags to DIM is not available on this deployment. Contact the site administrator.';
}

export function oauthFailureSuffix(): string {
  if (isDevBuild()) return '';
  return '\n\nTry signing in again. If the problem persists, contact the site administrator.';
}

export function oauthFailureDevChecklist(redirectUri: string, clientId: string | undefined): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return (
    `\n\nBungie app checklist (local dev):\n` +
    `• Redirect URL: ${redirectUri}\n` +
    `• Origin: ${origin}\n` +
    `• Client ID matches your Bungie application (${clientId ?? 'unknown'})\n` +
    `• API key is from the same Bungie application\n` +
    `• Restart the dev server after changing credentials`
  );
}
