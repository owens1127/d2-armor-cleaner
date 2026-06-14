import type { Archetype, ArmorSetInfo, ArmorSlot, ClassType, Stat } from '@/types';

export const STATS: Stat[] = [
  'weapons',
  'grenade',
  'super',
  'melee',
  'health',
  'class',
];

export const STAT_LABELS: Record<Stat, string> = {
  weapons: 'Weapons',
  grenade: 'Grenade',
  super: 'Super',
  melee: 'Melee',
  health: 'Health',
  class: 'Class',
};

/** Muted grayscale stat bar colors (monochrome UI) */
export const STAT_COLORS: Record<Stat, string> = {
  weapons: '#737373',
  grenade: '#828282',
  super: '#919191',
  melee: '#6b6b6b',
  health: '#a0a0a0',
  class: '#5c5c5c',
};

/** Bungie DestinyStatDefinition hashes for Armor 3.0 icon lookup */
export const STAT_MANIFEST_HASH: Record<Stat, number> = {
  weapons: 2996146975,
  grenade: 1735777505,
  super: 144602215,
  melee: 4244567218,
  health: 392767087,
  class: 1943323491,
};

/** Official Bungie stat icon paths (fallback before manifest loads) */
export const STAT_ICON_FALLBACK_PATHS: Record<Stat, string> = {
  weapons: '/common/destiny2_content/icons/bc69675acdae9e6b9a68a02fb4d62e07.png',
  grenade: '/common/destiny2_content/icons/065cdaabef560e5808e821cefaeaa22c.png',
  super: '/common/destiny2_content/icons/585ae4ede9c3da96b34086fccccdc8cd.png',
  melee: '/common/destiny2_content/icons/fa534aca76d7f2d7e7b4ba4df4271b42.png',
  health: '/common/destiny2_content/icons/717b8b218cc14325a54869bef21d2964.png',
  class: '/common/destiny2_content/icons/7eb845acb5b3a4a9b7e0b2f05f5c43f1.png',
};

export const ARCHETYPES: Archetype[] = [
  'gunner',
  'grenadier',
  'paragon',
  'brawler',
  'bulwark',
  'specialist',
  'reaver',
  'siegebreaker',
  'demolitionist',
  'skirmisher',
  'powerhouse',
  'colossus',
];

export const ARCHETYPE_STATS: Record<Archetype, [Stat, Stat]> = {
  gunner: ['weapons', 'grenade'],
  grenadier: ['grenade', 'super'],
  paragon: ['super', 'melee'],
  brawler: ['melee', 'health'],
  bulwark: ['health', 'class'],
  specialist: ['class', 'weapons'],
  reaver: ['class', 'melee'],
  siegebreaker: ['health', 'grenade'],
  demolitionist: ['grenade', 'class'],
  skirmisher: ['melee', 'weapons'],
  powerhouse: ['weapons', 'super'],
  colossus: ['super', 'health'],
};

export interface ArmorSetPerkLine {
  prefix: string;
  text: string;
}

/** "2pc" → "2-piece" for compact rank cards */
export function formatArmorSetPerkTierLabel(prefix: string): string {
  const match = prefix.match(/^(\d+)\s*pc$/i);
  if (match) return `${match[1]}-piece`;
  return prefix;
}

function resolveArmorSetPerkLine(
  perk: { name: string; description: string; pieces?: 2 | 4 },
  index: number,
): { prefix: string; rawText: string } {
  const pieceCount = perk.pieces ? `${perk.pieces}pc` : `${(index + 1) * 2}pc`;
  const name = perk.name.trim();
  const description = perk.description.trim();

  if (/^\d+\s*pc/i.test(name)) {
    const prefix = name.match(/^\d+\s*pc/i)![0].replace(/\s+/g, '');
    if (description) return { prefix, rawText: description };
    return { prefix, rawText: name };
  }

  if (description) return { prefix: pieceCount, rawText: description };
  return { prefix: pieceCount, rawText: name };
}

/** Full set bonus lines for calibration UI: never truncated */
export function getArmorSetPerkLines(
  armorSet: ArmorSetInfo | undefined,
  maxPerks = 2,
): ArmorSetPerkLine[] {
  if (!armorSet?.perks.length) return [];
  return armorSet.perks.slice(0, maxPerks).map((perk, i) => {
    const { prefix, rawText } = resolveArmorSetPerkLine(perk, i);
    return { prefix, text: rawText.trim() };
  });
}

export const ARMOR_SLOTS: ArmorSlot[] = [
  'helmet',
  'arms',
  'chest',
  'legs',
  'classItem',
];

export const CLASSES: ClassType[] = ['titan', 'hunter', 'warlock'];

/** Bungie class symbol icons (DestinyPresentationNodeDefinition, manifest) */
export const CLASS_ICON_FALLBACK_PATHS: Record<ClassType, string> = {
  titan: '/common/destiny2_content/icons/46a19ddd00d0f6ca822230943103b54a.png',
  hunter: '/common/destiny2_content/icons/05e32a388d9a65a0ef59b2193eee2db4.png',
  warlock: '/common/destiny2_content/icons/e4006d9a8fe167bd7e83193d7601c89a.png',
};

/** Bungie bucket type hash → slot */
export const BUCKET_TO_SLOT: Record<number, ArmorSlot> = {
  3448274439: 'helmet',
  3551918588: 'arms',
  14239492: 'chest',
  20886954: 'legs',
  1585787867: 'classItem',
};

/** Archetype intrinsic plug hashes (DestinyPlugSet 1315181101) */
export const PLUG_TO_ARCHETYPE: Record<number, Archetype> = {
  1807652646: 'gunner',
  3349393475: 'brawler',
  549468645: 'bulwark',
  4227065942: 'paragon',
  2937665788: 'grenadier',
  2230428468: 'specialist',
  351770835: 'reaver',
  2503381935: 'siegebreaker',
  2222960133: 'demolitionist',
  1687144140: 'skirmisher',
  544009373: 'powerhouse',
  1418248448: 'colossus',
};

/** Stat type hash → stat (Armor 3.0). Legacy Strength/Recovery hashes map to Melee/Class. */
export const STAT_HASH_TO_STAT: Record<number, Stat> = {
  144602215: 'super',
  392767087: 'health',
  1735777505: 'grenade',
  1943323491: 'class',
  4244567218: 'melee',
  2996146975: 'weapons',
};

/** Tuning mod plug hash → stat (tier5.report) */
export const TUNING_PLUG_TO_STAT: Record<number, Stat> = {
  309000506: 'grenade',
  311164277: 'melee',
  323635379: 'class',
  388618952: 'health',
  455024236: 'grenade',
  534630542: 'melee',
  673231129: 'super',
  691392383: 'weapons',
  891771298: 'weapons',
  957763733: 'class',
  1510949672: 'class',
  1672416975: 'grenade',
  1879022254: 'class',
  1918710127: 'weapons',
  1922571986: 'grenade',
  2125798995: 'health',
  2244422610: 'super',
  3121760799: 'weapons',
  3284443097: 'weapons',
  3310526732: 'health',
  3554800389: 'super',
  3681082702: 'health',
  3946669007: 'super',
  4020349587: 'melee',
  4026414261: 'super',
  4030660414: 'class',
  4088823605: 'health',
  4116389173: 'grenade',
  4164883102: 'melee',
  4210715468: 'melee',
};

export const POSTMASTER_BUCKET = 215593132;
export const VAULT_BUCKET = 138197802;

/** Reusable plug set on altar-tier armor tuning mod sockets (Edge of Fate). */
export const ALTAR_TUNING_MOD_PLUG_SET_HASH = 1155052024;
/** Empty tuning mod socket plug on altar-tier armor definitions. */
export const EMPTY_TUNING_MOD_SOCKET_HASH = 2121121504;

/**
 * Default minimum altar gearTier for dupe scope and browse filters (not import).
 * Import accepts any altar-tier piece with explicit gearTier 1-5.
 */
export const MIN_TIERABLE_GEAR_TIER = 4;

/** Valid minimum tier thresholds for dupe scope (1 = broadest, 5 = Tier 5 only). */
export const DUPE_MIN_TIER_VALUES = [1, 2, 3, 4, 5] as const;

export function formatDupeMinTierLabel(minTier: number): string {
  if (minTier >= 5) return 'Tier 5 only';
  return `Tier ${minTier}+`;
}

export const BUNGIE_CLASS_TO_TYPE: Record<number, ClassType> = {
  0: 'titan',
  1: 'hunter',
  2: 'warlock',
};

export const DEFAULT_DUPE_RULES = {
  minTier: 5,
  sameArmorSet: false,
  sameTuningStat: false,
  ignoreTaggedInfuse: true,
  ignoreTaggedJunk: true,
  ignoreTaggedKeep: true,
  ignoreTaggedFavorite: true,
  ignoreTaggedArchive: true,
  filterArmorSetHashes: [],
};

export const DUPE_PRESETS: Record<
  string,
  { rules: Partial<typeof DEFAULT_DUPE_RULES> }
> = {
  loose: {
    rules: {
      sameArmorSet: false,
      sameTuningStat: false,
      ignoreTaggedKeep: false,
      ignoreTaggedFavorite: false,
    },
  },
  standard: {
    rules: {
      sameArmorSet: false,
      sameTuningStat: false,
      ignoreTaggedKeep: true,
    },
  },
  setAware: {
    rules: { sameArmorSet: true, sameTuningStat: false, ignoreTaggedKeep: true },
  },
  tuning: {
    rules: { sameArmorSet: false, sameTuningStat: true, ignoreTaggedKeep: true },
  },
  strict: {
    rules: { sameArmorSet: true, sameTuningStat: true, ignoreTaggedKeep: true },
  },
};

export function isImpossibleCell(
  archetype: Archetype,
  tertiary: Stat,
): boolean {
  const [primary, secondary] = ARCHETYPE_STATS[archetype];
  return tertiary === primary || tertiary === secondary;
}

export function tertiaryStatsForArchetype(archetype: Archetype): Stat[] {
  const [primary, secondary] = ARCHETYPE_STATS[archetype];
  return STATS.filter((s) => s !== primary && s !== secondary);
}

/** Prefer losses in a bucket before auto-junk at bucket end (double elimination). */
export const BUCKET_ELIMINATION_LOSS_THRESHOLD = 2;
