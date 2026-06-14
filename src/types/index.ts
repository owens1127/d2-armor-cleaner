export type ClassType = 'titan' | 'hunter' | 'warlock';
export type ArmorSlot = 'helmet' | 'arms' | 'chest' | 'legs' | 'classItem';
export type Stat =
  | 'weapons'
  | 'grenade'
  | 'super'
  | 'melee'
  | 'health'
  | 'class';
export type Archetype =
  | 'gunner'
  | 'grenadier'
  | 'paragon'
  | 'brawler'
  | 'bulwark'
  | 'specialist'
  | 'reaver'
  | 'siegebreaker'
  | 'demolitionist'
  | 'skirmisher'
  | 'powerhouse'
  | 'colossus';
export type TagValue = 'keep' | 'junk' | 'favorite' | 'infuse' | 'archive';
export type Confidence = 'low' | 'medium' | 'high';
/** How aggressively the user wants to trim vault armor during cleaning. */
export type VaultKeepPreference = 'lean' | 'balanced' | 'options' | 'hoarder';

export interface ArmorSetPerkInfo {
  name: string;
  description: string;
  /** Bungie CDN path from DestinySandboxPerkDefinition (2pc/4pc bonus icon). */
  icon?: string;
  /** Pieces required to activate this perk tier (from setPerks.requiredSetCount). */
  pieces?: 2 | 4;
}

export interface ArmorSetInfo {
  hash: number;
  name: string;
  perks: ArmorSetPerkInfo[];
}

export interface ArmorPiece {
  instanceId: string;
  itemHash: number;
  name: string;
  icon?: string;
  classType: ClassType;
  armorSlot: ArmorSlot;
  /** Bungie instance gearTier (1-5) on altar-tier armor; null on legacy or when unknown. */
  tier: number | null;
  power: number;
  location: 'vault' | 'character' | 'postmaster';
  archetype: Archetype;
  /** Intrinsic armor roll only (no equipped stat mods, no masterwork +2). */
  baseStats: Partial<Record<Stat, number>>;
  /** Equipped armor stat mod bonuses from socket plugs (see parseArmorFromProfile). */
  modStats?: Partial<Record<Stat, number>>;
  /** When true, `modStats` stack on `baseStats` in effectiveStats (always true when modStats set). */
  modStatsAdditive?: boolean;
  tertiaryStat: Stat;
  tuningStat?: Stat;
  armorSet?: ArmorSetInfo;
  isMasterwork: boolean;
  /** keep / junk / infuse / archive from DIM Sync (not favorite). */
  dimTag?: TagValue | null;
  /** Heart overlay - set when DIM tag is `favorite`. */
  dimFavorite?: boolean;
  statConfigurations?: Partial<Record<Stat, number>>[];
  isDupe?: boolean;
  isIgnored?: boolean;
  wantScore?: number;
  wantConfidence?: Confidence;
}

export interface DupeRuleConfig {
  minTier: number;
  sameArmorSet: boolean;
  sameTuningStat: boolean;
  ignoreTaggedInfuse: boolean;
  ignoreTaggedJunk: boolean;
  ignoreTaggedKeep: boolean;
  ignoreTaggedFavorite: boolean;
  ignoreTaggedArchive: boolean;
  filterArmorSetHashes: number[];
}

export interface DupeBucketKey {
  classType: ClassType;
  armorSlot: ArmorSlot;
  archetype: Archetype;
  tertiaryStat: Stat;
  armorSetHash?: number;
  tuningStat?: Stat;
}

export interface DupeBucket {
  key: DupeBucketKey;
  items: ArmorPiece[];
  hasDupes: boolean;
}

export interface VaultProfile {
  totalT5: number;
  totalBySlot: Record<ArmorSlot, number>;
  dupeBucketCount: Record<string, number>;
  heavyBuckets: number;
  taggedKeepInDupes: number;
  uniqueBucketRatio: number;
  largestBucket: { key: DupeBucketKey; count: number } | null;
}

export interface DupeRuleSuggestion {
  rule: keyof DupeRuleConfig | 'preset';
  presetId?: string;
  recommended: boolean;
  reasonKey: string;
  reasonParams?: Record<string, string | number>;
  impact: { buckets: number; itemsToReview: number };
}

export interface ClassVaultState {
  classType: ClassType;
  items: ArmorPiece[];
  buckets: DupeBucket[];
  profile: VaultProfile;
  ruleSuggestions: DupeRuleSuggestion[];
  activeDupeRules: DupeRuleConfig;
  lastScannedAt: number;
}

/** One deduplicated calibration decision, keyed by round (e.g. mode, stats, archetype:0). */
export interface CalibrationChoice {
  key: string;
  recordedAt: number;
}

/** One stat line target for a desired build (armor-only, masterwork assumed). */
export interface StatTarget {
  stat: Stat;
  /** Target total across five armor slots; clamped 10–200. */
  target: number;
}

/** @deprecated Use targetsMode; kept for stored prefs migration. */
export type BuildTargetMode = 'priority' | 'custom';

/** Tier cutoffs (200/150/100/80) or per-stat custom totals. */
export type StatPriorityTargetsMode = 'tier' | 'custom';

/** Ordered stat priorities (2–4 lines) for vault achievability - not a full loadout. */
export interface DesiredBuild {
  id: string;
  /** Previous slug/ULID id kept for bookmarked URLs after migration to encoded ids. */
  legacyId?: string;
  name: string;
  /** @deprecated Use targetsMode */
  mode?: BuildTargetMode;
  /** Default tier: natural cutoffs by rank; custom: user-entered targets. */
  targetsMode?: StatPriorityTargetsMode;
  /** 2–4 stats in priority order (first = most important). */
  statTargets: StatTarget[];
  /** Optional armor set bonus targets for loadout recommendations. */
  setBonus2pc?: number;
  /** Second set for a 2+2 mix, or same as setBonus2pc for a 4pc single-set target. */
  setBonus4pc?: number;
  enabled?: boolean;
  /** @deprecated Migrated to tuningRepresentatives on read. */
  slotRepresentatives?: Partial<Record<ArmorSlot, string>>;
  /** User-chosen vault piece per pattern column (instanceId). Key: archetype:tertiary:tuning. */
  rollPatternRepresentatives?: Partial<Record<string, string>>;
  /** User-chosen vault piece per armor slot within each roll pattern column. Key: patternKey or patternKey:setHash when set bonus configured. */
  rollPatternSlotRepresentatives?: Partial<
    Record<string, Partial<Record<ArmorSlot, string>>>
  >;
  /** @deprecated Migrated to rollPatternRepresentatives on read. */
  tuningRepresentatives?: Partial<Record<Stat, string>>;
}

/** Per-class calibration and scoring preferences. */
export interface ClassPreferenceProfile {
  calibratedAt?: number;
  /** Unique calibration decisions: count derived via getCalibrationChoiceCount. */
  calibrationChoices: Record<string, CalibrationChoice>;
  statWeights: Record<Stat, number>;
  archetypeWeights: Record<Archetype, number>;
  tertiaryWeights: Partial<Record<Archetype, Partial<Record<Stat, number>>>>;
  tuningWeights: Partial<Record<Archetype, Partial<Record<Stat, number>>>>;
  setWeights: Record<number, number>;
  setCompletionBonus: number;
  /** Stat-focused builds this class should support (coverage + browse). */
  desiredBuilds?: DesiredBuild[];
}

/** Peer grouping for redundant-roll comparison (stat-lower + tuning-duplicate). */
export interface RedundantPeerScope {
  groupBySet: boolean;
  groupByTuning: boolean;
}

/** Class scope for auto-filter rules (`all` matches every class). */
export type AutoFilterClassScope = ClassType | 'all';

/** Per-criterion match mode (`is` = default for migrated rules). */
export type AutoFilterMatchMode = 'is' | 'not' | 'anyOf' | 'noneOf';

/** User-defined rule that queues matching armor for junk on vault load. */
export interface AutoFilterRule {
  id: string;
  enabled: boolean;
  /** Optional label; auto-generated from criteria when omitted. */
  name?: string;
  classType: AutoFilterClassScope;
  /** Single-value criterion (legacy and Is / Is not). */
  archetype?: Archetype;
  /** Multi-value criterion (Any of / None of). */
  archetypes?: Archetype[];
  archetypeMatchMode?: AutoFilterMatchMode;
  tertiaryStat?: Stat;
  tertiaryStats?: Stat[];
  tertiaryStatMatchMode?: AutoFilterMatchMode;
  tuningStat?: Stat;
  tuningStats?: Stat[];
  tuningStatMatchMode?: AutoFilterMatchMode;
  armorSlot?: ArmorSlot;
  armorSlots?: ArmorSlot[];
  armorSlotMatchMode?: AutoFilterMatchMode;
  armorSetHash?: number;
  armorSetHashes?: number[];
  armorSetHashMatchMode?: AutoFilterMatchMode;
}

export interface PreferenceProfile {
  version: number;
  /** Primary storage: each class has independent prefs. */
  classPrefs: Record<ClassType, ClassPreferenceProfile>;
  /** Shared default dupe rules (per-class overrides live in vault store). */
  defaultDupeRules: DupeRuleConfig;
  /** Target vault size from onboarding: informs trim estimates and rule suggestions. */
  vaultKeepPreference?: VaultKeepPreference;
  /** @deprecated Merged into dupe rules (`sameArmorSet`); stripped on load. */
  redundantGroupBySet?: boolean;
  /** @deprecated Merged into dupe rules (`sameTuningStat`); stripped on load. */
  redundantGroupByTuning?: boolean;
  /** Rules that auto-queue matching pieces for junk when the vault loads or refreshes. */
  autoFilterRules?: AutoFilterRule[];
}

export interface DupeDecision {
  bucketKey: DupeBucketKey;
  /** Primary kept piece for legacy sessions; see keptIds for full list. */
  keptId: string;
  keptIds: string[];
  junkedIds: string[];
  wasRecommendationFollowed: boolean;
  timestamp: number;
}

export interface PendingTag {
  instanceId: string;
  tag: TagValue | null;
  itemName: string;
  classType: ClassType;
  archetype?: Archetype;
  tertiaryStat?: Stat;
  tuningStat?: Stat;
}

export interface ScoreBreakdown {
  total: number;
  statFit: number;
  archetypeFit: number;
  tertiaryFit: number;
  tuningFit: number;
  setFit: number;
  dominance: number;
  explanations: string[];
  confidence: Confidence;
}

export interface BungieMembership {
  /** Bungie.net global membership ID (for DIM auth) */
  bungieMembershipId: string;
  /** Destiny platform membership ID (for profile + DIM tags) */
  destinyMembershipId: string;
  membershipType: number;
  displayName: string;
}
