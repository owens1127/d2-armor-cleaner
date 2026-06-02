import { CLASS_ICON_FALLBACK_PATHS, STAT_ICON_FALLBACK_PATHS } from '@/lib/constants';
import type { ArmorPiece, ArmorSlot, ClassType, Stat } from '@/types';

let manifestStatIcons: Partial<Record<Stat, string>> | null = null;

/** Cache stat icon paths from DestinyStatDefinition after manifest load. */
export function setManifestStatIcons(icons: Partial<Record<Stat, string>>): void {
  manifestStatIcons = icons;
}

export function statIconUrl(stat: Stat): string {
  const path = manifestStatIcons?.[stat] ?? STAT_ICON_FALLBACK_PATHS[stat];
  return bungieIconUrl(path) ?? '';
}

export function classIconUrl(classType: ClassType): string {
  return bungieIconUrl(CLASS_ICON_FALLBACK_PATHS[classType]) ?? '';
}

const BUNGIE_CDN = 'https://www.bungie.net';

/**
 * Real Bungie armor icons per slot (legendary items from manifest) for CDN fallback
 */
export const SLOT_ICON_PATHS: Record<ArmorSlot, string> = {
  helmet: '/common/destiny2_content/icons/172009eaee2bb314b70bc95565ba82ad.jpg',
  arms: '/common/destiny2_content/icons/496a18dc30a12bc879e0a088a137aa46.jpg',
  chest: '/common/destiny2_content/icons/ec88f1ed1bc957aded9fe08e92c138be.jpg',
  legs: '/common/destiny2_content/icons/75e3af034764f29c9d92d227e60015ae.jpg',
  classItem: '/common/destiny2_content/icons/24102c017a76a1ff66c180f413fa7484.jpg',
};

/** Neutral slot silhouette: only when Bungie CDN is unreachable */
export const SLOT_FALLBACK_SVG: Record<ArmorSlot, string> = {
  helmet:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect fill='%23121824' width='64' height='64'/%3E%3Cpath fill='%234a5568' d='M32 10c-11 0-18 9-18 20v10h36V30C50 19 43 10 32 10z'/%3E%3C/svg%3E",
  arms: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect fill='%23121824' width='64' height='64'/%3E%3Cpath fill='%234a5568' d='M14 22h14v32H14zm28 0h8v32h-8z'/%3E%3C/svg%3E",
  chest:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect fill='%23121824' width='64' height='64'/%3E%3Cpath fill='%234a5568' d='M18 18h28v28H18z'/%3E%3C/svg%3E",
  legs: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect fill='%23121824' width='64' height='64'/%3E%3Cpath fill='%234a5568' d='M20 14h10v38H20zm14 0h10v38H34z'/%3E%3C/svg%3E",
  classItem:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect fill='%23121824' width='64' height='64'/%3E%3Ccircle fill='%234a5568' cx='32' cy='32' r='14'/%3E%3C/svg%3E",
};

export function bungieIconUrl(iconPath?: string | null): string | undefined {
  if (!iconPath?.trim()) return undefined;
  const trimmed = iconPath.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${BUNGIE_CDN}${path}`;
}

export function slotIconUrl(slot: ArmorSlot): string {
  return bungieIconUrl(SLOT_ICON_PATHS[slot]) ?? SLOT_FALLBACK_SVG[slot];
}

export function itemIconUrl(piece: Pick<ArmorPiece, 'icon' | 'armorSlot'>): string {
  return bungieIconUrl(piece.icon) ?? slotIconUrl(piece.armorSlot);
}
