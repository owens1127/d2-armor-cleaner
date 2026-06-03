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

export function isDevBuild(): boolean {
  return import.meta.env.DEV;
}

export {
  bungieSignInUnavailableMessageCopy as bungieSignInUnavailableMessage,
  bungieCredentialsMissingMessageCopy as bungieCredentialsMissingMessage,
  dimSyncUnavailableMessageCopy as dimSyncUnavailableMessage,
  oauthFailureSuffixCopy as oauthFailureSuffix,
  oauthFailureDevChecklistCopy as oauthFailureDevChecklist,
} from '@/i18n/errorsCopy';
