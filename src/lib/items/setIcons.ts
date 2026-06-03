import type { ManifestItemSetDef, ManifestSandboxPerkDef } from '@/lib/bungie/manifest';
import { bungieIconUrl } from '@/lib/items/icons';
import type { ArmorPiece, ArmorSetInfo } from '@/types';

export interface ResolvedArmorSetIcon {
  pieces: 2 | 4;
  icon?: string;
  name?: string;
  description?: string;
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
        description: perk?.displayProperties.description,
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

/** Display name for an armor set hash (vault piece, then loaded manifest). */
export function resolveArmorSetDisplayName(
  setHash: number,
  items: ArmorPiece[] = [],
): string | undefined {
  const fromVault = resolveArmorSetByHash(items, setHash)?.name;
  if (fromVault) return fromVault;
  return manifestSetIcons?.get(setHash)?.name;
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

function perksFromManifestEntry(entry: ManifestSetEntry): ArmorSetInfo['perks'] {
  return entry.perks.map((perk) => ({
    name: perk.name ?? `${perk.pieces}pc`,
    description: perk.description?.trim() ?? '',
    icon: perk.icon,
    pieces: perk.pieces,
  }));
}

function mergeSetPerks(
  vaultPerks: ArmorSetInfo['perks'],
  manifestPerks: ArmorSetInfo['perks'],
): ArmorSetInfo['perks'] {
  if (manifestPerks.length === 0) return vaultPerks;
  if (vaultPerks.length === 0) return manifestPerks;

  return vaultPerks.map((vaultPerk, index) => {
    if (vaultPerk.description.trim()) return vaultPerk;
    const manifestPerk =
      manifestPerks.find((p) => p.pieces === vaultPerk.pieces) ?? manifestPerks[index];
    if (!manifestPerk?.description.trim()) return vaultPerk;
    return { ...vaultPerk, description: manifestPerk.description };
  });
}

/** Richest armor set info for a hash (vault pieces, manifest cache for names/perks). */
export function resolveArmorSetInfoForHash(
  setHash: number,
  items: ArmorPiece[] = [],
): ArmorSetInfo | undefined {
  const vault = resolveArmorSetByHash(items, setHash);
  const manifest = manifestSetIcons?.get(setHash);
  const name = vault?.name ?? manifest?.name;
  if (!name) return undefined;

  const vaultPerks = vault?.perks ?? [];
  const manifestPerks = manifest ? perksFromManifestEntry(manifest) : [];
  const perks = mergeSetPerks(vaultPerks, manifestPerks);

  if (perks.length === 0 && !vault) return undefined;
  return { hash: setHash, name, perks };
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
