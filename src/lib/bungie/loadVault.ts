import {
  clearMembershipCache,
  primeMembershipCache,
  resolveDestinyMembership,
} from '@/lib/bungie/membership';
import { resetBootstrapVaultLoad } from '@/lib/bungie/vaultBootstrap';
import { getAppLocale } from '@/i18n';
import { loadManifestTables } from '@/lib/bungie/manifest';
import { fetchProfileInventory } from '@/lib/bungie/profile';
import { getBungieAccessToken } from '@/lib/bungie/client';
import { parseArmorFromProfile, type ParseDiagnostics } from '@/lib/armor/parse';
import { exchangeDimToken, fetchDimTags } from '@/lib/dim/auth';
import {
  type DimItemTagState,
} from '@/lib/dim/parseTags';
import {
  loadLocalDimTagOverrides,
  mergeDimTagMapWithLocalOverrides,
  pruneSyncedLocalOverrides,
  saveLocalDimTagOverrides,
} from '@/lib/dim/localTagOverrides';
import { isDimConfigured } from '@/lib/dim/tags';
import { clearVaultCache } from '@/lib/vault/cache';
import {
  clearBungieAuthStorage,
  getBungieAuthItem,
  setBungieAuthItem,
} from '@/lib/bungie/authStorage';
import { LOG_PREFIX, SS_BUNGIE_OAUTH_STATE, SS_MEMBERSHIP } from '@/lib/storage/keys';
import type { FetchProfileDiagnostics } from '@/lib/bungie/profile';
import type { ArmorPiece, BungieMembership } from '@/types';

export interface LoadVaultResult {
  membership: BungieMembership;
  items: ArmorPiece[];
  dimTags: Record<string, DimItemTagState>;
  diagnostics: ParseDiagnostics;
  fetchDiagnostics: FetchProfileDiagnostics;
}

export interface LoadLiveVaultOptions {
  /** Skip DIM tag sync (only when intentionally avoiding API calls). */
  skipDimSync?: boolean;
  cachedDimTags?: Record<string, DimItemTagState>;
}

export async function loadLiveVault(
  onProgress?: (msg: string) => void,
  options?: LoadLiveVaultOptions,
): Promise<LoadVaultResult> {
  onProgress?.('Resolving Destiny membership…');
  const restored = restoreMembership();
  if (restored) primeMembershipCache(restored);
  const membership = await resolveDestinyMembership();
  setBungieAuthItem(SS_MEMBERSHIP, JSON.stringify(membership));

  const manifestLocale = getAppLocale();
  onProgress?.('Loading Destiny manifest…');
  const manifest = await loadManifestTables(onProgress, manifestLocale);

  onProgress?.('Fetching inventory…');
  const { items: rawItems, components, rawItemCount, fetchDiagnostics } =
    await fetchProfileInventory(
      membership.membershipType,
      membership.destinyMembershipId,
      { onProgress, manifest },
    );

  let dimTags: Record<string, DimItemTagState> = options?.cachedDimTags ?? {};
  const bungieToken = getBungieAccessToken();
  const shouldSyncDim = bungieToken && isDimConfigured() && !options?.skipDimSync;

  if (shouldSyncDim) {
    try {
      onProgress?.('Syncing DIM tags…');
      const dimToken = await exchangeDimToken(bungieToken, membership.bungieMembershipId);
      dimTags = await fetchDimTags(dimToken, membership.destinyMembershipId);
    } catch {
      onProgress?.('DIM sync skipped (tags unavailable)');
    }
  } else if (Object.keys(dimTags).length > 0) {
    onProgress?.('Using cached DIM tags…');
  }

  const membershipId = membership.destinyMembershipId;
  let localOverrides = loadLocalDimTagOverrides(membershipId);
  const pruned = pruneSyncedLocalOverrides(dimTags, localOverrides);
  if (pruned !== localOverrides) {
    localOverrides = pruned;
    saveLocalDimTagOverrides(membershipId, localOverrides);
  }
  if (Object.keys(localOverrides).length > 0) {
    dimTags = mergeDimTagMapWithLocalOverrides(dimTags, localOverrides);
  }

  onProgress?.(`Parsing tiered armor (${rawItemCount} instanced)…`);
  const { items, diagnostics } = parseArmorFromProfile(
    rawItems,
    components,
    manifest,
    dimTags,
  );

  const skipTotal = Object.values(diagnostics.skipped).reduce((a, b) => a + b, 0);
  console.info(`${LOG_PREFIX} vault load`, {
    api: fetchDiagnostics,
    parse: diagnostics,
    skips: skipTotal > 0 ? diagnostics.skipped : undefined,
  });

  onProgress?.(
    `Found ${items.length} tiered armor pieces · ${rawItemCount} instanced from API`,
  );

  return {
    membership,
    items,
    dimTags,
    diagnostics,
    fetchDiagnostics,
  };
}

export function restoreMembership(): BungieMembership | null {
  try {
    const raw = getBungieAuthItem(SS_MEMBERSHIP);
    if (!raw) return null;
    const m = JSON.parse(raw) as BungieMembership;
    // Migrate old shape
    if ('membershipId' in m && !('destinyMembershipId' in m)) {
      const legacy = m as BungieMembership & { membershipId: string };
      return {
        bungieMembershipId: legacy.membershipId,
        destinyMembershipId: legacy.membershipId,
        membershipType: legacy.membershipType,
        displayName: legacy.displayName,
      };
    }
    return m;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  const membership = restoreMembership();
  clearMembershipCache();
  resetBootstrapVaultLoad();
  clearBungieAuthStorage();
  sessionStorage.removeItem(SS_BUNGIE_OAUTH_STATE);
  void clearVaultCache(membership?.destinyMembershipId);
}

export function hasActiveSession(): boolean {
  return Boolean(getBungieAccessToken() && restoreMembership());
}
