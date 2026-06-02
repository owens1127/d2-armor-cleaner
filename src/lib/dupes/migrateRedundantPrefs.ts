import { mergeDupeRules } from '@/lib/dupes/rules';
import { LS_MIGRATED_REDUNDANT_DUPE, LS_PREFS } from '@/lib/storage/keys';
import type { DupeRuleConfig } from '@/types';

interface LegacyRedundantPrefs {
  redundantGroupBySet?: boolean;
  redundantGroupByTuning?: boolean;
}

/**
 * One-time: copy legacy profile redundant-roll toggles into dupe rules, then drop profile fields.
 */
export function migrateRedundantPrefsIntoDupeRules(
  dupeRules: DupeRuleConfig,
): DupeRuleConfig {
  if (localStorage.getItem(LS_MIGRATED_REDUNDANT_DUPE) === '1') {
    return dupeRules;
  }

  let legacy: LegacyRedundantPrefs | null = null;
  try {
    const raw = localStorage.getItem(LS_PREFS);
    if (raw) {
      const data = JSON.parse(raw) as LegacyRedundantPrefs;
      const hasSet = Object.prototype.hasOwnProperty.call(data, 'redundantGroupBySet');
      const hasTuning = Object.prototype.hasOwnProperty.call(
        data,
        'redundantGroupByTuning',
      );
      if (hasSet || hasTuning) {
        legacy = {
          ...(hasSet ? { redundantGroupBySet: data.redundantGroupBySet } : {}),
          ...(hasTuning
            ? { redundantGroupByTuning: data.redundantGroupByTuning }
            : {}),
        };
      }
    }
  } catch {
    /* ignore */
  }

  localStorage.setItem(LS_MIGRATED_REDUNDANT_DUPE, '1');

  if (!legacy) return dupeRules;

  return mergeDupeRules({
    ...dupeRules,
    ...(legacy.redundantGroupBySet !== undefined
      ? { sameArmorSet: legacy.redundantGroupBySet }
      : {}),
    ...(legacy.redundantGroupByTuning !== undefined
      ? { sameTuningStat: legacy.redundantGroupByTuning }
      : {}),
  });
}
