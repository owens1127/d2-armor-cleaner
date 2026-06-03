import type { AppLocale } from '@/i18n/manifestLocales';
import type { ManifestTables } from '@/lib/bungie/manifest';
import { reloadManifestForLocale } from '@/lib/bungie/manifest';
import { restoreMembership } from '@/lib/bungie/loadVault';
import { resolveArmorSetFromManifest } from '@/lib/armor/parse';
import { clearVaultComputeCache } from '@/lib/coverage/vaultComputeCache';
import { readVaultCache, writeVaultCache } from '@/lib/vault/cache';
import type { ArmorPiece } from '@/types';

/** Re-apply Bungie display names and set labels from a (possibly new-locale) manifest. */
export function applyManifestDisplayNames(
  items: ArmorPiece[],
  manifest: ManifestTables,
): ArmorPiece[] {
  return items.map((item) => {
    const itemDef = manifest.items[String(item.itemHash)];
    if (!itemDef) return item;
    const armorSet = resolveArmorSetFromManifest(itemDef, manifest);
    return {
      ...item,
      name: itemDef.displayProperties.name,
      icon: itemDef.displayProperties.icon,
      armorSet,
    };
  });
}

/** Patch in-memory vault items from a locale manifest and invalidate coverage caches. */
export async function relocalizeVaultDisplayFromManifest(
  locale: AppLocale,
): Promise<void> {
  const manifest = await reloadManifestForLocale(locale);
  const { useVaultStore } = await import('@/stores/vaultStore');
  const state = useVaultStore.getState();
  if (state.allItems.length === 0) return;

  const items = applyManifestDisplayNames(state.allItems, manifest);
  clearVaultComputeCache();
  const lastParsedCount = state.lastParsedCount ?? items.length;
  const fetchedAt = state.vaultFetchedAt ?? Date.now();
  state.relocalizeVaultDisplayNames(items, lastParsedCount, fetchedAt);

  const { useAuthStore } = await import('@/stores/authStore');
  const membership = useAuthStore.getState().membership ?? restoreMembership();
  if (membership) {
    const cached = await readVaultCache(membership.destinyMembershipId);
    if (cached && cached.items.length > 0) {
      await writeVaultCache({ ...cached, items, lastParsedCount, fetchedAt });
    }
  }
}
