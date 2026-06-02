import { useMemo, type ReactNode } from 'react';
import { BuildOptimalContext } from '@/components/items/buildOptimalContext';
import { buildBuildOptimalLookups } from '@/lib/coverage/buildOptimal';
import {
  fingerprintArmorItems,
  fingerprintCoveragePrefs,
  getOrComputeVaultCache,
} from '@/lib/coverage/vaultComputeCache';
import { getClassPrefs } from '@/lib/prefs/profile';
import { CLASSES } from '@/lib/constants';
import { usePrefsStore, useVaultStore } from '@/stores';

export function BuildOptimalProvider({ children }: { children: ReactNode }) {
  const profile = usePrefsStore((s) => s.profile);
  const allItems = useVaultStore((s) => s.allItems);
  const lookups = useMemo(() => {
    const prefsKey = CLASSES.map((c) => fingerprintCoveragePrefs(getClassPrefs(profile, c))).join(
      '|',
    );
    const key = `optimal:${fingerprintArmorItems(allItems)}:${prefsKey}`;
    return getOrComputeVaultCache(key, () => buildBuildOptimalLookups(profile, allItems));
  }, [profile, allItems]);

  return (
    <BuildOptimalContext.Provider value={lookups}>{children}</BuildOptimalContext.Provider>
  );
}
