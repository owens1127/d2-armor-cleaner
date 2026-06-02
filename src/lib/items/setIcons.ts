import type { ManifestItemSetDef, ManifestSandboxPerkDef } from '@/lib/bungie/manifest';
import { bungieIconUrl } from '@/lib/items/icons';
import type { ArmorPiece, ArmorSetInfo } from '@/types';

export interface ResolvedArmorSetIcon {
  pieces: 2 | 4;
  icon?: string;
  name?: string;
}

interface ManifestSetEntry {
  name: string;
  perks: ResolvedArmorSetIcon[];
}

let manifestSetIcons: Map<number, ManifestSetEntry> | null = null;

function perkPiecesFromSetEntry(
  requiredSetCount: number | undefined,
  index: number,
): 2 | 4 {
  if (requiredSetCount === 2 || requiredSetCount === 4) return requiredSetCount;
  return ((index + 1) * 2) as 2 | 4;
}

/** Cache armor set perk icons from manifest tables (2pc/4pc sandbox perk icons). */
export function setManifestArmorSetIcons(
  itemSets: Record<string, ManifestItemSetDef>,
  sandboxPerks: Record<string, ManifestSandboxPerkDef>,
): void {
  const map = new Map<number, ManifestSetEntry>();
  for (const [hashStr, setDef] of Object.entries(itemSets)) {
    const perks = setDef.setPerks.map((entry, index) => {
      const perk = sandboxPerks[String(entry.sandboxPerkHash)];
      return {
        pieces: perkPiecesFromSetEntry(entry.requiredSetCount, index),
        icon: perk?.displayProperties.icon,
        name: perk?.displayProperties.name,
      };
    });
    map.set(Number(hashStr), {
      name: setDef.displayProperties.name,
      perks,
    });
  }
  manifestSetIcons = map;
}

/** Reset manifest cache (tests). */
export function clearManifestArmorSetIcons(): void {
  manifestSetIcons = null;
}

export function resolveArmorSetByHash(
  items: ArmorPiece[],
  setHash: number,
): ArmorSetInfo | undefined {
  let best: ArmorSetInfo | undefined;
  for (const item of items) {
    if (item.armorSet?.hash !== setHash) continue;
    if (!best || item.armorSet.perks.length > best.perks.length) {
      best = item.armorSet;
    }
  }
  return best;
}

function iconsFromSetInfo(setInfo: ArmorSetInfo | undefined): ResolvedArmorSetIcon[] {
  if (!setInfo?.perks.length) return [];
  return setInfo.perks
    .filter((perk) => perk.icon)
    .map((perk) => ({
      pieces: perk.pieces ?? 2,
      icon: perk.icon,
      name: perk.name,
    }));
}

/** Resolve 2pc/4pc perk icons for a set hash (vault pieces, then manifest cache). */
export function resolveArmorSetIcons(
  setHash: number,
  items: ArmorPiece[] = [],
  setInfo?: ArmorSetInfo,
): ResolvedArmorSetIcon[] {
  const fromArg = iconsFromSetInfo(setInfo);
  if (fromArg.length > 0) return fromArg;

  const fromVault = iconsFromSetInfo(resolveArmorSetByHash(items, setHash));
  if (fromVault.length > 0) return fromVault;

  return manifestSetIcons?.get(setHash)?.perks.filter((p) => p.icon) ?? [];
}

export function armorSetIconUrls(
  setHash: number,
  items: ArmorPiece[] = [],
  setInfo?: ArmorSetInfo,
  maxIcons = 2,
  piecesTier?: 2 | 4,
): string[] {
  let entries = resolveArmorSetIcons(setHash, items, setInfo);
  if (piecesTier !== undefined) {
    entries = entries.filter((entry) => entry.pieces === piecesTier);
  }
  return entries
    .slice(0, maxIcons)
    .map((entry) => bungieIconUrl(entry.icon))
    .filter((url): url is string => Boolean(url));
}

export function uniqueSetTargetHashes(hashes: number[]): number[] {
  return [...new Set(hashes)];
}
