import type { ManifestTables } from '@/lib/bungie/manifest';
import { resolveArmorSetFromManifest } from '@/lib/armor/parse';
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
