import type { PreferenceProfile } from '@/types';
import { defaultPreferenceProfile, migrateProfile } from '@/lib/prefs/profile';
import { LS_PREFS } from '@/lib/storage/keys';

export function loadPrefs(): PreferenceProfile {
  try {
    const raw = localStorage.getItem(LS_PREFS);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      const migrated = migrateProfile(parsed);
      const hadLegacy =
        parsed &&
        typeof parsed === 'object' &&
        ('redundantGroupBySet' in parsed || 'redundantGroupByTuning' in parsed);
      if (hadLegacy) savePrefs(migrated);
      return migrated;
    }
  } catch {
    /* ignore */
  }
  return defaultPreferenceProfile();
}

export function savePrefs(prefs: PreferenceProfile) {
  localStorage.setItem(LS_PREFS, JSON.stringify(prefs));
}

export function parseImportedPrefs(raw: string): PreferenceProfile {
  return migrateProfile(JSON.parse(raw));
}
