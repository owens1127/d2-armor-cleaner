import { create } from 'zustand';
import type { ParseDiagnostics } from '@/lib/armor/parse';
import type { FetchProfileDiagnostics } from '@/lib/bungie/profile';
import { applyAutoFilterRules } from '@/lib/auto-filter/apply';
import { VAULT_CACHE_SCHEMA_VERSION } from '@/lib/vault/cache';
import { parseDimItemTag } from '@/lib/dim/parseTags';
import type {
  ArmorPiece,
  ClassType,
  ClassVaultState,
  DupeRuleConfig,
  TagValue,
} from '@/types';
import { CLASSES, DUPE_PRESETS } from '@/lib/constants';
import { mergeDupeRules } from '@/lib/dupes/rules';
import { LS_ONBOARDING } from '@/lib/storage/keys';
import { buildClassVaultState } from '@/lib/dupes/suggest';
import { scoreAllItems } from '@/lib/scoring/score';
import { loadLiveVault, hasActiveSession, restoreMembership } from '@/lib/bungie/loadVault';
import {
  loadStoredDupeRules,
  saveStoredDupeRules,
  snapshotDupeRules,
} from '@/lib/dupe-rules/storage';
import { clearOnboardingProgress, markOnboardingComplete } from '@/lib/onboarding/storage';
import {
  applyLocalOverridesToArmorPieces,
  loadLocalDimTagOverrides,
  recordLocalDimTagOverrides,
} from '@/lib/dim/localTagOverrides';
import {
  clearVaultCacheMeta,
  patchVaultCacheDimTags,
  readVaultCache,
  writeVaultCache,
} from '@/lib/vault/cache';
import { resolveDimSyncFlags } from '@/lib/vault/refreshPolicy';
import {
  isVaultRefreshBlocked,
  whenVaultRefreshUnblocked,
} from '@/lib/vault/refreshGuard';
import { useAuthStore } from '@/stores/authStore';
import { usePrefsStore } from '@/stores/prefsStore';

interface VaultStore {
  allItems: ArmorPiece[];
  classStates: Partial<Record<ClassType, ClassVaultState>>;
  globalDupeRules: DupeRuleConfig;
  classRuleOverrides: Partial<Record<ClassType, DupeRuleConfig>>;
  strictness: number;
  onboardingComplete: boolean;
  vaultLoading: boolean;
  vaultRefreshing: boolean;
  vaultError: string | null;
  vaultStatus: string | null;
  lastParsedCount: number | null;
  vaultFetchedAt: number | null;
  vaultParseDiagnostics: ParseDiagnostics | null;
  vaultFetchDiagnostics: FetchProfileDiagnostics | null;
  clearVaultError: () => void;
  loadLiveVault: (options?: {
    force?: boolean;
    background?: boolean;
    skipDimSync?: boolean;
  }) => Promise<void>;
  hydrateVaultFromCache: () => Promise<boolean>;
  setGlobalDupeRules: (rules: Partial<DupeRuleConfig>) => void;
  setStrictness: (n: number) => void;
  applyPreset: (presetId: string, classType?: ClassType) => void;
  setClassDupeRules: (classType: ClassType, rules: Partial<DupeRuleConfig>) => void;
  resetClassDupeRules: (classType: ClassType) => void;
  refreshClassStates: (onlyClass?: ClassType) => void;
  setOnboardingComplete: (v: boolean) => void;
  patchItemDimTags: (updates: { instanceId: string; tag: TagValue | null }[]) => void;
}

const storedRules = loadStoredDupeRules();

let liveVaultInFlight: Promise<void> | null = null;
let vaultHydratePromise: Promise<boolean> | null = null;
let deferredBackgroundLoadOptions: { force?: boolean; background?: boolean } | null = null;
let backgroundStatusThrottleAt = 0;
const BACKGROUND_STATUS_THROTTLE_MS = 500;

type PendingVaultApply = {
  items: ArmorPiece[];
  lastParsedCount: number;
  fetchedAt: number;
  parseDiagnostics: ParseDiagnostics;
  fetchDiagnostics: FetchProfileDiagnostics;
};

let pendingVaultApply: PendingVaultApply | null = null;

function runAutoFiltersOnVault(items: ArmorPiece[]): void {
  const rules = usePrefsStore.getState().profile.autoFilterRules ?? [];
  applyAutoFilterRules(items, rules);
}

function commitVaultItems(
  items: ArmorPiece[],
  lastParsedCount: number,
  fetchedAt: number,
): void {
  const { globalDupeRules, classRuleOverrides } = useVaultStore.getState();
  const prefs = usePrefsStore.getState().profile;
  const scored = scoreAllItems(items, prefs);
  const classStates = buildAllClassStates(scored, globalDupeRules, classRuleOverrides);
  useVaultStore.setState({
    allItems: scored,
    classStates,
    lastParsedCount,
    vaultFetchedAt: fetchedAt,
  });
  runAutoFiltersOnVault(scored);
  void import('@/stores/sessionStore').then(({ useSessionStore }) => {
    useSessionStore.getState().reconcilePendingWithVault();
  });
}

function flushPendingVaultApply(): void {
  if (!pendingVaultApply || isVaultRefreshBlocked()) return;
  const pending = pendingVaultApply;
  pendingVaultApply = null;
  commitVaultItems(pending.items, pending.lastParsedCount, pending.fetchedAt);
  useVaultStore.setState({
    vaultParseDiagnostics: pending.parseDiagnostics,
    vaultFetchDiagnostics: pending.fetchDiagnostics,
    vaultRefreshing: false,
    vaultStatus: null,
    vaultError: null,
  });
}

function applyVaultItems(
  items: ArmorPiece[],
  lastParsedCount: number,
  fetchedAt: number,
  parseDiagnostics: ParseDiagnostics,
  fetchDiagnostics: FetchProfileDiagnostics,
): void {
  if (isVaultRefreshBlocked()) {
    pendingVaultApply = {
      items,
      lastParsedCount,
      fetchedAt,
      parseDiagnostics,
      fetchDiagnostics,
    };
    whenVaultRefreshUnblocked(flushPendingVaultApply);
    return;
  }
  pendingVaultApply = null;
  commitVaultItems(items, lastParsedCount, fetchedAt);
  useVaultStore.setState({
    vaultParseDiagnostics: parseDiagnostics,
    vaultFetchDiagnostics: fetchDiagnostics,
  });
}

function scheduleDeferredBackgroundLoad(
  options: { force?: boolean; background?: boolean },
): Promise<void> {
  deferredBackgroundLoadOptions = options;
  whenVaultRefreshUnblocked(() => {
    if (!deferredBackgroundLoadOptions) return;
    const next = deferredBackgroundLoadOptions;
    deferredBackgroundLoadOptions = null;
    void useVaultStore.getState().loadLiveVault(next);
  });
  return Promise.resolve();
}

function reportVaultLoadProgress(msg: string, isBackground: boolean): void {
  if (isBackground) {
    const now = Date.now();
    if (now - backgroundStatusThrottleAt < BACKGROUND_STATUS_THROTTLE_MS) return;
    backgroundStatusThrottleAt = now;
  }
  useVaultStore.setState({ vaultStatus: msg });
}

export function waitForVaultHydrate(): Promise<boolean> {
  return vaultHydratePromise ?? Promise.resolve(false);
}

/** Re-hydrate vault after remount when the in-memory store was reset. */
export async function ensureVaultHydrated(): Promise<boolean> {
  const state = useVaultStore.getState();
  if (state.allItems.length > 0 || Boolean(state.classStates.hunter)) return true;

  if (!vaultHydratePromise) {
    vaultHydratePromise = (async () => {
      if (!hasActiveSession()) return false;
      return useVaultStore.getState().hydrateVaultFromCache();
    })();
  }
  return waitForVaultHydrate();
}

function persistDupeRules(
  global: DupeRuleConfig,
  strictness: number,
  classStates: Partial<Record<ClassType, ClassVaultState>>,
) {
  saveStoredDupeRules(snapshotDupeRules(global, strictness, classStates));
}

function buildAllClassStates(
  scored: ArmorPiece[],
  globalDupeRules: DupeRuleConfig,
  classRuleOverrides: Partial<Record<ClassType, DupeRuleConfig>>,
): Record<ClassType, ClassVaultState> {
  return Object.fromEntries(
    CLASSES.map((c) => [
      c,
      buildClassVaultState(c, scored, classRuleOverrides[c] ?? globalDupeRules),
    ]),
  ) as Record<ClassType, ClassVaultState>;
}

export const useVaultStore = create<VaultStore>((set, get) => ({
  allItems: [],
  classStates: {},
  globalDupeRules: storedRules.global,
  strictness: storedRules.strictness,
  classRuleOverrides: storedRules.classOverrides,
  onboardingComplete: localStorage.getItem(LS_ONBOARDING) === 'true',
  vaultLoading: false,
  vaultRefreshing: false,
  vaultError: null,
  vaultStatus: null,
  lastParsedCount: null,
  vaultFetchedAt: null,
  vaultParseDiagnostics: null,
  vaultFetchDiagnostics: null,

  clearVaultError: () => set({ vaultError: null }),

  hydrateVaultFromCache: async () => {
    const membership = useAuthStore.getState().membership ?? restoreMembership();
    if (!membership) return false;

    const cached = await readVaultCache(membership.destinyMembershipId);
    if (!cached || cached.items.length === 0) return false;

    const overrides = loadLocalDimTagOverrides(membership.destinyMembershipId);
    const items = applyLocalOverridesToArmorPieces(cached.items, overrides);
    commitVaultItems(items, cached.lastParsedCount, cached.fetchedAt);
    if (cached.parseDiagnostics || cached.fetchDiagnostics) {
      useVaultStore.setState({
        vaultParseDiagnostics: cached.parseDiagnostics ?? null,
        vaultFetchDiagnostics: cached.fetchDiagnostics ?? null,
      });
    }
    return true;
  },

  loadLiveVault: async (options?: {
    force?: boolean;
    background?: boolean;
    skipDimSync?: boolean;
  }) => {
    if (liveVaultInFlight && !options?.force) return liveVaultInFlight;

    const membership = useAuthStore.getState().membership ?? restoreMembership();
    const cached = membership ? await readVaultCache(membership.destinyMembershipId) : null;
    const hasCachedItems = Boolean(cached && cached.items.length > 0);
    const isBackground = Boolean(options?.background || (hasCachedItems && !options?.force));

    if (isBackground && isVaultRefreshBlocked() && !options?.force) {
      return scheduleDeferredBackgroundLoad({ ...options, background: true });
    }

    const run = async () => {
      if (isBackground) {
        backgroundStatusThrottleAt = 0;
        set({ vaultRefreshing: true, vaultError: null, vaultStatus: 'Refreshing…' });
      } else {
        set({ vaultLoading: true, vaultError: null, vaultStatus: 'Starting…' });
      }
      try {
        const { membership, items, diagnostics, dimTags, fetchDiagnostics } =
          await loadLiveVault(
            (msg) => reportVaultLoadProgress(msg, isBackground),
            {
              ...resolveDimSyncFlags(options),
              cachedDimTags: cached?.dimTags,
            },
          );
        const auth = useAuthStore.getState();
        if (
          !auth.membership ||
          auth.membership.destinyMembershipId !== membership.destinyMembershipId
        ) {
          auth.setMembership(membership);
        }
        const fetchedAt = Date.now();
        await writeVaultCache({
          schemaVersion: VAULT_CACHE_SCHEMA_VERSION,
          destinyMembershipId: membership.destinyMembershipId,
          items,
          lastParsedCount: diagnostics.parsed,
          dimTags,
          fetchedAt,
          parseDiagnostics: diagnostics,
          fetchDiagnostics,
        });
        applyVaultItems(items, diagnostics.parsed, fetchedAt, diagnostics, fetchDiagnostics);
        const storedComplete = localStorage.getItem(LS_ONBOARDING) === 'true';
        if (get().onboardingComplete !== storedComplete) {
          set({ onboardingComplete: storedComplete });
        }
        const applyDeferred = pendingVaultApply !== null;
        set({
          vaultLoading: false,
          vaultRefreshing: applyDeferred && isBackground,
          vaultStatus: applyDeferred && isBackground ? 'Updating vault…' : null,
          vaultError: null,
        });
      } catch (e) {
        pendingVaultApply = null;
        set({
          vaultLoading: false,
          vaultRefreshing: false,
          vaultError: e instanceof Error ? e.message : 'Failed to load vault',
          vaultStatus: null,
        });
      }
    };

    liveVaultInFlight = run().finally(() => {
      liveVaultInFlight = null;
    });
    return liveVaultInFlight;
  },

  setGlobalDupeRules: (partial) => {
    const globalDupeRules = mergeDupeRules({ ...get().globalDupeRules, ...partial });
    set({ globalDupeRules });
    get().refreshClassStates();
    const { classStates, strictness } = get();
    persistDupeRules(globalDupeRules, strictness, classStates);
  },

  setStrictness: (strictness) => {
    set({ strictness });
    const presets = ['loose', 'standard', 'setAware', 'tuning', 'strict'] as const;
    const idx =
      strictness < 25 ? 0 : strictness < 50 ? 1 : strictness < 75 ? 2 : strictness < 90 ? 3 : 4;
    get().applyPreset(presets[idx]);
    persistDupeRules(get().globalDupeRules, strictness, get().classStates);
  },

  applyPreset: (presetId, classType) => {
    const partial = DUPE_PRESETS[presetId]?.rules ?? {};
    const rules = mergeDupeRules(partial);
    if (classType) {
      const { allItems, classStates, classRuleOverrides, globalDupeRules, strictness } = get();
      const prefs = usePrefsStore.getState().profile;
      const scored = scoreAllItems(allItems, prefs);
      const newOverrides = { ...classRuleOverrides, [classType]: rules };
      const nextStates = {
        ...classStates,
        [classType]: buildClassVaultState(classType, scored, rules),
      };
      set({ classRuleOverrides: newOverrides, classStates: nextStates, allItems: scored });
      persistDupeRules(globalDupeRules, strictness, nextStates);
    } else {
      set({ globalDupeRules: rules });
      get().refreshClassStates();
      persistDupeRules(rules, get().strictness, get().classStates);
    }
  },

  setClassDupeRules: (classType, partial) => {
    const { allItems, classStates, classRuleOverrides, globalDupeRules, strictness } = get();
    const current = classRuleOverrides[classType] ?? classStates[classType]?.activeDupeRules ?? globalDupeRules;
    const rules = mergeDupeRules({ ...current, ...partial });
    const prefs = usePrefsStore.getState().profile;
    const scored = scoreAllItems(allItems, prefs);
    const newOverrides = { ...classRuleOverrides, [classType]: rules };
    const nextStates = {
      ...classStates,
      [classType]: buildClassVaultState(classType, scored, rules),
    };
    set({ classRuleOverrides: newOverrides, classStates: nextStates, allItems: scored });
    persistDupeRules(globalDupeRules, strictness, nextStates);
  },

  resetClassDupeRules: (classType) => {
    const { allItems, classStates, classRuleOverrides, globalDupeRules, strictness } = get();
    const prefs = usePrefsStore.getState().profile;
    const scored = scoreAllItems(allItems, prefs);
    const newOverrides = { ...classRuleOverrides };
    delete newOverrides[classType];
    const nextStates = {
      ...classStates,
      [classType]: buildClassVaultState(classType, scored, globalDupeRules),
    };
    set({ classRuleOverrides: newOverrides, classStates: nextStates, allItems: scored });
    persistDupeRules(globalDupeRules, strictness, nextStates);
  },

  refreshClassStates: (onlyClass?: ClassType) => {
    const { allItems, globalDupeRules, classStates, classRuleOverrides } = get();
    if (allItems.length === 0) return;
    const prefs = usePrefsStore.getState().profile;
    const scored = scoreAllItems(allItems, prefs);
    const update = (c: ClassType) =>
      buildClassVaultState(c, scored, classRuleOverrides[c] ?? globalDupeRules);
    if (onlyClass) {
      const nextStates = { ...classStates, [onlyClass]: update(onlyClass) };
      set({ allItems: scored, classStates: nextStates });
    } else {
      const nextStates = Object.fromEntries(CLASSES.map((c) => [c, update(c)])) as Record<
        ClassType,
        ClassVaultState
      >;
      set({ allItems: scored, classStates: nextStates });
    }
    runAutoFiltersOnVault(scored);
  },

  setOnboardingComplete: (v) => {
    if (v) {
      markOnboardingComplete();
    } else {
      localStorage.setItem(LS_ONBOARDING, String(v));
      clearOnboardingProgress();
    }
    set({ onboardingComplete: v });
  },

  patchItemDimTags: (updates) => {
    if (updates.length === 0) return;
    const membership =
      useAuthStore.getState().membership?.destinyMembershipId ??
      restoreMembership()?.destinyMembershipId;
    if (membership) {
      recordLocalDimTagOverrides(membership, updates);
      void patchVaultCacheDimTags(membership, updates);
    }
    const updateMap = new Map(updates.map((u) => [u.instanceId, u.tag]));
    const { allItems, globalDupeRules, classRuleOverrides } = get();
    const nextItems = allItems.map((item) => {
      const tag = updateMap.get(item.instanceId);
      if (tag === undefined) return item;
      const parsed = tag === null ? { dimTag: null, dimFavorite: false } : parseDimItemTag(tag);
      return {
        ...item,
        dimTag: parsed.dimTag,
        dimFavorite: parsed.dimFavorite,
      };
    });
    const prefs = usePrefsStore.getState().profile;
    const scored = scoreAllItems(nextItems, prefs);
    const rebuild = (c: ClassType) =>
      buildClassVaultState(c, scored, classRuleOverrides[c] ?? globalDupeRules);
    const nextStates = Object.fromEntries(
      CLASSES.map((c) => [c, rebuild(c)]),
    ) as Record<ClassType, ClassVaultState>;
    set({ allItems: scored, classStates: nextStates });
  },
}));

export function resetVaultStore(): void {
  clearVaultCacheMeta();
  pendingVaultApply = null;
  deferredBackgroundLoadOptions = null;
  useVaultStore.setState({
    allItems: [],
    classStates: {},
    lastParsedCount: null,
    vaultFetchedAt: null,
    vaultParseDiagnostics: null,
    vaultFetchDiagnostics: null,
    vaultLoading: false,
    vaultRefreshing: false,
    vaultError: null,
    vaultStatus: null,
  });
}

export function startVaultHydrate(): Promise<boolean> {
  vaultHydratePromise = (async () => {
    if (!hasActiveSession()) return false;
    return useVaultStore.getState().hydrateVaultFromCache();
  })();
  return vaultHydratePromise;
}
