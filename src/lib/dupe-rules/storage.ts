import type { ClassType, DupeRuleConfig } from '@/types';
import { migrateRedundantPrefsIntoDupeRules } from '@/lib/dupes/migrateRedundantPrefs';
import { mergeDupeRules } from '@/lib/dupes/rules';
import { LS_DUPE_RULES } from '@/lib/storage/keys';

export interface StoredDupeRules {
  global: DupeRuleConfig;
  strictness: number;
  classOverrides: Partial<Record<ClassType, DupeRuleConfig>>;
}

export function loadStoredDupeRules(): StoredDupeRules {
  try {
    const raw = localStorage.getItem(LS_DUPE_RULES);
    if (!raw) {
      return {
        global: migrateRedundantPrefsIntoDupeRules(mergeDupeRules()),
        strictness: 50,
        classOverrides: {},
      };
    }
    const parsed = JSON.parse(raw) as Partial<StoredDupeRules>;
    const mergedGlobal = mergeDupeRules(
      parsed.global as Partial<DupeRuleConfig> & Record<string, unknown>,
    );
    const global = migrateRedundantPrefsIntoDupeRules(mergedGlobal);
    const result = {
      global,
      strictness: parsed.strictness ?? 50,
      classOverrides: parsed.classOverrides ?? {},
    };
    if (
      global.sameArmorSet !== mergedGlobal.sameArmorSet ||
      global.sameTuningStat !== mergedGlobal.sameTuningStat
    ) {
      saveStoredDupeRules(result);
    }
    return result;
  } catch {
    return {
      global: migrateRedundantPrefsIntoDupeRules(mergeDupeRules()),
      strictness: 50,
      classOverrides: {},
    };
  }
}

export function saveStoredDupeRules(data: StoredDupeRules): void {
  localStorage.setItem(LS_DUPE_RULES, JSON.stringify(data));
}

export function snapshotDupeRules(
  global: DupeRuleConfig,
  strictness: number,
  classStates: Partial<Record<ClassType, { activeDupeRules: DupeRuleConfig }>>,
): StoredDupeRules {
  const classOverrides: Partial<Record<ClassType, DupeRuleConfig>> = {};
  for (const c of ['titan', 'hunter', 'warlock'] as ClassType[]) {
    const state = classStates[c];
    if (!state) continue;
    if (JSON.stringify(state.activeDupeRules) !== JSON.stringify(global)) {
      classOverrides[c] = state.activeDupeRules;
    }
  }
  return { global, strictness, classOverrides };
}
