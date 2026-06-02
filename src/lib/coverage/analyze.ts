import {
  ARCHETYPE_STATS,
  ARCHETYPES,
  ARMOR_SLOTS,
  isImpossibleCell,
  SLOT_LABELS,
  STATS,
} from '@/lib/constants';
import { intrinsicStats } from '@/lib/armor/intrinsicCompare';
import { MASTERWORK_STAT_BONUS } from '@/lib/armor/effectiveStats';
import { formatDupeBucketLabel } from '@/lib/dupes/queue';
import type {
  Archetype,
  ArmorPiece,
  ArmorSlot,
  ClassPreferenceProfile,
  ClassType,
  DupeBucket,
  Stat,
  StatTarget,
} from '@/types';
import {
  computeStatAchievability,
  isBestTierLoadoutPiece,
  priorityStatsFromTargets,
  type StatAchievability,
} from '@/lib/coverage/achievability';
import {
  analyzeRecommendedLoadout,
  pieceLoadoutContribution,
  type LoadoutVerdict,
  type RecommendedLoadout,
} from '@/lib/coverage/loadout';
import {
  type BuildProfile,
  focusStatsFromTargets,
  getDesiredBuilds,
  resolveDesiredBuild,
} from '@/lib/coverage/builds';
import {
  countSetPiecesInLoadout,
  countSetSlotsWithPieces,
  isDualTwoPieceMix,
  parseSetBonusTargets,
  resolveSetName,
  setBonusConfigFromBuild,
  totalSetPiecesRequired,
} from '@/lib/coverage/setBonus';

export type { BuildProfile } from '@/lib/coverage/builds';
export type {
  StatAchievability,
  StatAchievabilityStatus,
  TuningFit,
  TuningFitLevel,
} from '@/lib/coverage/achievability';
export {
  buildTuningFitScore,
  buildVerdictFromRows,
  computeStatAchievability,
  formatAchievabilityStatus,
  formatBuildVerdict,
  formatTuningFitLevel,
  isBestTierLoadoutPiece,
  isTuningAligned,
  pieceTuningFit,
  priorityStatsFromTargets,
  tuningFitScore,
} from '@/lib/coverage/achievability';
export {
  analyzeRecommendedLoadout,
  analyzeRecommendedPatternLoadout,
  analyzeRecommendedTuningLoadout,
  bestPiecesForPatternBySlot,
  bestSetPieceInSlot,
  isBestSetPieceInSlotForCombo,
  isTopGoldColumnPiece,
  isColumnSlotEligiblePiece,
  countEligibleBuildBadgesByInstance,
  columnSlotContextFromColumn,
  formatTopGoldColumnTooltip,
  globalGoldBadgePlacementKeys,
  topGoldColumnPiece,
  formatBestSetPieceInSlotTooltip,
  bestPiecesForTuningStatBySlot,
  deriveOptimalRollPatterns,
  formatLoadoutSlotStatus,
  formatLoadoutVerdictSummary,
  archetypePriorityIntrinsics,
  archetypeIrrelevantSecondary,
  formatArchetypeGroupLabel,
  formatArchetypeRollContext,
  formatOptimalRollArchetypeLegend,
  formatEmptyPatternColumnMessage,
  formatEmptyPatternRollContext,
  formatEmptyPatternSlotAriaLabel,
  formatEmptyPatternSlotMessage,
  type EmptyPatternMessageOptions,
  formatOptimalRollBannerIntro,
  formatOptimalRollPatternLabel,
  formatPatternRollLine,
  formatRollStatBonusLabel,
  formatRollStatRoleLabel,
  rollPatternStatBonuses,
  OPTIMAL_ROLL_TERTIARY_BONUS,
  OPTIMAL_ROLL_TUNING_BONUS,
  type RollPatternStatBonus,
  type RollStatRole,
  formatPatternLoadoutVerdictSummary,
  formatPieceLoadoutFitLabel,
  formatTuningLoadoutStatus,
  formatTuningLoadoutVerdictSummary,
  loadoutVerdictFromLoadout,
  migrateRollPatternToSlotRepresentatives,
  migrateSlotToRollPatternRepresentatives,
  migrateSlotToTuningRepresentatives,
  migrateTuningToRollPatternRepresentatives,
  optimalRollPatternKey,
  patternSetColumnKey,
  expandRollPatternSlotRepresentativesForSetTargets,
  patternLoadoutVerdictFromLoadout,
  pieceEligibleForPatternColumn,
  pieceEligibleForTuningColumn,
  pieceLoadoutContribution,
  pieceMatchesRollPattern,
  orderEligiblePiecesForSlotPicker,
  rankEligiblePiecesForPattern,
  rankEligiblePiecesForPatternInSlot,
  rankEligiblePiecesForSlot,
  rankEligiblePiecesForTuningStat,
  resolveEffectiveRollPatternRepresentatives,
  resolveEffectiveRollPatternSlotRepresentatives,
  resolveEffectiveTuningRepresentatives,
  resolvePatternLoadoutPiece,
  resolvePatternSlotLoadoutPiece,
  resolveSlotLoadoutPiece,
  resolveTuningLoadoutPiece,
  selectRecommendedLoadout,
  selectRecommendedPatternLoadout,
  selectRecommendedTuningLoadout,
  tuningLoadoutVerdictFromLoadout,
  viableTuningStats,
  isValidPatternRepresentative,
  isValidPatternSlotRepresentative,
  isValidSlotRepresentative,
  isValidTuningRepresentative,
  type PatternLoadoutEntry,
  type PatternLoadoutSource,
  type PatternSlotLoadoutEntry,
  type RecommendedPatternLoadout,
  type ResolvedPatternLoadout,
  type ResolvedSlotLoadout,
  type ResolvedTuningLoadout,
  type SlotLoadoutSource,
  type TuningLoadoutEntry,
  type TuningLoadoutSource,
  type EligibleLoadoutPiece,
  type LoadoutVerdict,
  type OptimalRollPattern,
  type RecommendedLoadout,
  type RecommendedTuningLoadout,
  type SlotLoadoutEntry,
  type TuningSlotLoadoutEntry,
} from '@/lib/coverage/loadout';
export type { BuildVerdict } from '@/lib/coverage/achievability';
export {
  clampStatTarget,
  createDesiredBuild,
  defaultStatTargetsFromPrefs,
  focusStatsFromTargets,
  formatStatTargetsLabel,
  getDesiredBuilds,
  MAX_STAT_PRIORITIES,
  MIN_STAT_PRIORITIES,
  RECOMMENDED_DESIRED_BUILD_COUNT,
  normalizeArmorSetHash,
  normalizeDesiredBuild,
  normalizeDesiredBuilds,
  normalizeRollPatternRepresentatives,
  normalizeSlotRepresentatives,
  normalizeTuningRepresentatives,
  resolveBuildProfile,
  resolveDesiredBuild,
} from '@/lib/coverage/builds';
export {
  buildBuildOptimalLookup,
  buildBuildOptimalLookups,
  isBuildOptimalPiece,
  matchingBuildNames,
  type BuildOptimalLookup,
  type BuildOptimalRollIdentity,
} from '@/lib/coverage/buildOptimal';

export interface SetBonusProgress {
  /** Armor set hash. */
  hash: number;
  /** Display name when known from vault. */
  name: string;
  /** 2 or 4 — set bonus tier this row tracks. */
  tier: 2 | 4;
  /** Pieces required to activate this tier. */
  required: number;
  /** Armor slots (of five) where vault has at least one piece of this set. */
  slotsFilled: number;
  met: boolean;
}

export interface SetBonusReadiness {
  progress: SetBonusProgress[];
  /** Vault slot coverage for each set target (max possible regardless of loadout). */
  vaultProgress: SetBonusProgress[];
  /** Recommended loadout meets every configured set tier. */
  tiersMet: boolean;
  /** Vault has enough set slots to meet every configured tier. */
  vaultTiersMet: boolean;
  /** Both tiers can be worn together on five slots (same set, or only one tier configured). */
  equipableTogether: boolean;
  /** True when configured set quotas need more than five armor pieces total. */
  conflictingSets: boolean;
}

export type SetBonusCountMode = 'vault-slots' | 'loadout-pieces';

export interface SlotBuildCoverage {
  slot: ArmorSlot;
  covered: boolean;
  bestPiece: ArmorPiece | null;
}

export interface CoverageGap {
  key: DupeBucket['key'];
  label: string;
  /** How many target stats this empty profile would roll. */
  buildStatHits: number;
}

export interface OverlapCluster {
  key: DupeBucket['key'];
  label: string;
  count: number;
}

export interface CoverageAnalysis {
  build: BuildProfile;
  /** Best piece per slot maximizing the combined priority stat set. */
  recommendedLoadout: RecommendedLoadout;
  loadoutVerdict: LoadoutVerdict;
  /** @deprecated Per-stat tuning rows — use recommendedLoadout instead. */
  statAchievability: StatAchievability[];
  slotsCovered: number;
  slotCoverage: SlotBuildCoverage[];
  /** True when all five slots have an optimal piece. */
  loadoutComplete: boolean;
  /** @deprecated Use loadoutComplete. */
  targetsMet: boolean;
  /** @deprecated Use loadoutComplete. */
  statsComfortable: boolean;
  setBonusReadiness: SetBonusReadiness;
  /** True when recommended loadout fills all five slots. */
  buildReady: boolean;
  gaps: CoverageGap[];
  overlaps: OverlapCluster[];
  /** Distinct non-empty stat profiles (archetype × tertiary × slot). */
  filledProfiles: number;
  /** Possible profiles excluding impossible tertiary cells. */
  possibleProfiles: number;
  /** Pieces whose roll identity supports this build. */
  supportingPieces: number;
  /** True when many pieces support the build but slots remain uncovered. */
  redundantOverlap: boolean;
}

export interface BuildBalanceInsight {
  buildId: string;
  label: string;
  slotsCovered: number;
  supportingPieces: number;
  loadoutComplete: boolean;
  /** High pieces + low slot coverage suggests hoarding overlap. */
  overlapRisk: boolean;
  /** Low pieces + low slot coverage suggests a gap to fill. */
  coverageGap: boolean;
}

/** Intrinsic roll + masterwork (+2 per rolled line), always assumed for build math. */
export function assumedMasterworkStats(item: ArmorPiece): Partial<Record<Stat, number>> {
  const roll = intrinsicStats(item);
  const out: Partial<Record<Stat, number>> = {};
  for (const stat of STATS) {
    const val = roll[stat] ?? 0;
    if (val > 0) out[stat] = val + MASTERWORK_STAT_BONUS;
  }
  return out;
}

/** Roll identity stats: archetype pair, tertiary, optional tuning. */
export function pieceStatIdentity(item: ArmorPiece): Set<Stat> {
  const [primary, secondary] = ARCHETYPE_STATS[item.archetype];
  const stats = new Set<Stat>([primary, secondary, item.tertiaryStat]);
  if (item.tuningStat) stats.add(item.tuningStat);
  return stats;
}

export function bucketStatIdentity(
  archetype: Archetype,
  tertiary: Stat,
): Set<Stat> {
  const [primary, secondary] = ARCHETYPE_STATS[archetype];
  return new Set<Stat>([primary, secondary, tertiary]);
}

export function profileSupportsStats(identity: Set<Stat>, focus: Stat[]): boolean {
  return focus.some((s) => identity.has(s));
}

export function pieceSupportsBuild(item: ArmorPiece, focus: Stat[]): boolean {
  return profileSupportsStats(pieceStatIdentity(item), focus);
}

export { countSetSlotsWithPieces, resolveSetName } from '@/lib/coverage/setBonus';

function countSetProgress(
  items: ArmorPiece[],
  setHash: number,
  mode: SetBonusCountMode,
): number {
  return mode === 'loadout-pieces'
    ? countSetPiecesInLoadout(items, setHash)
    : countSetSlotsWithPieces(items, setHash);
}

function buildSetBonusProgress(
  items: ArmorPiece[],
  targets: ReturnType<typeof parseSetBonusTargets>,
  mode: SetBonusCountMode,
  nameItems: ArmorPiece[],
): SetBonusProgress[] {
  return targets.map((target) => {
    const filled = countSetProgress(items, target.hash, mode);
    return {
      hash: target.hash,
      name: resolveSetName(nameItems, target.hash),
      tier: target.pieces,
      required: target.pieces,
      slotsFilled: filled,
      met: filled >= target.pieces,
    };
  });
}

export function computeSetBonusReadiness(
  items: ArmorPiece[],
  build: Pick<BuildProfile, 'setBonus2pc' | 'setBonus4pc'>,
  mode: SetBonusCountMode = 'vault-slots',
  nameItems: ArmorPiece[] = items,
  vaultItems?: ArmorPiece[],
): SetBonusReadiness {
  const targets = parseSetBonusTargets(build.setBonus2pc, build.setBonus4pc);
  const progress = buildSetBonusProgress(items, targets, mode, nameItems);
  const vaultSource = vaultItems ?? (mode === 'vault-slots' ? items : nameItems);
  const vaultProgress = buildSetBonusProgress(
    vaultSource,
    targets,
    'vault-slots',
    nameItems,
  );

  const tiersMet = progress.length === 0 || progress.every((p) => p.met);
  const vaultTiersMet = vaultProgress.length === 0 || vaultProgress.every((p) => p.met);
  const conflictingSets = totalSetPiecesRequired(targets) > ARMOR_SLOTS.length;
  const dualMix = isDualTwoPieceMix(build.setBonus2pc, build.setBonus4pc);
  const equipableTogether =
    !conflictingSets &&
    (progress.length === 0 ||
      (dualMix
        ? progress.every((p) => p.met)
        : progress.every((p) => p.met) &&
          (targets.length === 1
            ? countSetProgress(items, targets[0]!.hash, mode) >= targets[0]!.pieces
            : true)));

  return {
    progress,
    vaultProgress,
    tiersMet,
    vaultTiersMet,
    equipableTogether,
    conflictingSets,
  };
}

export function formatSetBonusProgressLabel(entry: SetBonusProgress): string {
  return `${entry.slotsFilled}/${entry.required} pieces for ${entry.tier}pc ${entry.name}`;
}

export function formatSetBonusVaultReachLabel(entry: SetBonusProgress): string {
  return `Vault has pieces in ${entry.slotsFilled}/${entry.required} slots for ${entry.tier}pc ${entry.name}`;
}

export function buildFitTotal(
  item: ArmorPiece,
  targets: StatTarget[],
  _setBonuses?: Pick<BuildProfile, 'setBonus2pc' | 'setBonus4pc'>,
): number {
  return pieceLoadoutContribution(item, priorityStatsFromTargets(targets));
}

function compareBuildPieces(a: ArmorPiece, b: ArmorPiece, targets: StatTarget[]): number {
  const priorities = priorityStatsFromTargets(targets);
  const scoreDiff = pieceLoadoutContribution(b, priorities) - pieceLoadoutContribution(a, priorities);
  if (scoreDiff !== 0) return scoreDiff;
  return (b.wantScore ?? 0) - (a.wantScore ?? 0);
}

export function buildReadinessForSlot(
  items: ArmorPiece[],
  slot: ArmorSlot,
  targets: StatTarget[],
): SlotBuildCoverage {
  const priorities = priorityStatsFromTargets(targets);
  const candidates = items.filter(
    (i) => i.armorSlot === slot && isBestTierLoadoutPiece(i, priorities),
  );
  if (candidates.length === 0) {
    return { slot, covered: false, bestPiece: null };
  }
  const bestPiece = candidates.reduce((best, item) =>
    compareBuildPieces(best, item, targets) > 0 ? item : best,
  );
  return { slot, covered: true, bestPiece };
}

export function countPossibleProfiles(): number {
  let count = 0;
  for (const archetype of ARCHETYPES) {
    for (const _slot of ARMOR_SLOTS) {
      for (const stat of STATS) {
        if (!isImpossibleCell(archetype, stat)) count++;
      }
    }
  }
  return count;
}

function bucketCount(bucket: DupeBucket): number {
  return bucket.items.filter((i) => !i.isIgnored).length;
}

function bucketSupportsBuild(bucket: DupeBucket, focus: Stat[]): boolean {
  const identity = bucketStatIdentity(bucket.key.archetype, bucket.key.tertiaryStat);
  return profileSupportsStats(identity, focus);
}

export function findCoverageGaps(
  buckets: DupeBucket[],
  focus: Stat[],
  limit = 6,
): CoverageGap[] {
  const filled = new Set(
    buckets
      .filter((b) => bucketCount(b) > 0)
      .map((b) => `${b.key.archetype}|${b.key.armorSlot}|${b.key.tertiaryStat}`),
  );

  const gaps: CoverageGap[] = [];
  for (const archetype of ARCHETYPES) {
    for (const slot of ARMOR_SLOTS) {
      for (const tertiary of STATS) {
        if (isImpossibleCell(archetype, tertiary)) continue;
        const id = `${archetype}|${slot}|${tertiary}`;
        if (filled.has(id)) continue;
        const identity = bucketStatIdentity(archetype, tertiary);
        const buildStatHits = focus.filter((s) => identity.has(s)).length;
        if (buildStatHits === 0) continue;
        gaps.push({
          key: {
            classType: buckets[0]?.key.classType ?? 'hunter',
            armorSlot: slot,
            archetype,
            tertiaryStat: tertiary,
          },
          label: formatDupeBucketLabel({
            classType: buckets[0]?.key.classType ?? 'hunter',
            armorSlot: slot,
            archetype,
            tertiaryStat: tertiary,
          }),
          buildStatHits,
        });
      }
    }
  }

  return gaps
    .sort(
      (a, b) =>
        b.buildStatHits - a.buildStatHits ||
        a.label.localeCompare(b.label),
    )
    .slice(0, limit);
}

export function findOverlapClusters(
  buckets: DupeBucket[],
  minCount = 3,
  limit = 5,
): OverlapCluster[] {
  return buckets
    .map((b) => ({ bucket: b, count: bucketCount(b) }))
    .filter(({ count }) => count >= minCount)
    .sort((a, b) => b.count - a.count || a.bucket.key.armorSlot.localeCompare(b.bucket.key.armorSlot))
    .slice(0, limit)
    .map(({ bucket, count }) => ({
      key: bucket.key,
      label: formatDupeBucketLabel(bucket.key),
      count,
    }));
}

export function findBuildOverlapClusters(
  buckets: DupeBucket[],
  focus: Stat[],
  minCount = 3,
  limit = 5,
): OverlapCluster[] {
  return buckets
    .filter((b) => bucketSupportsBuild(b, focus))
    .map((b) => ({ bucket: b, count: bucketCount(b) }))
    .filter(({ count }) => count >= minCount)
    .sort((a, b) => b.count - a.count || a.bucket.key.armorSlot.localeCompare(b.bucket.key.armorSlot))
    .slice(0, limit)
    .map(({ bucket, count }) => ({
      key: bucket.key,
      label: formatDupeBucketLabel(bucket.key),
      count,
    }));
}

export function analyzeCoverage(
  items: ArmorPiece[],
  buckets: DupeBucket[],
  build: BuildProfile,
): CoverageAnalysis {
  const targets = build.statTargets;
  const focus = focusStatsFromTargets(targets);
  const { loadout: recommendedLoadout, loadoutVerdict } = analyzeRecommendedLoadout(
    items,
    targets,
    setBonusConfigFromBuild(build),
  );
  const slotCoverage = recommendedLoadout.slots.map(({ slot, piece }) => ({
    slot,
    covered: piece !== null,
    bestPiece: piece,
  }));
  const slotsCovered = recommendedLoadout.slotsFilled;
  const statAchievability = computeStatAchievability(items, targets);
  const loadoutComplete = slotsCovered === ARMOR_SLOTS.length;
  const targetsMet = loadoutComplete;
  const statsComfortable = loadoutComplete;
  const setBonusReadiness = computeSetBonusReadiness(
    recommendedLoadout.pieces.length > 0 ? recommendedLoadout.pieces : items,
    build,
    recommendedLoadout.pieces.length > 0 ? 'loadout-pieces' : 'vault-slots',
    items,
    items,
  );
  const buildReady = loadoutComplete;
  const filledProfiles = buckets.filter((b) => bucketCount(b) > 0).length;
  const supportingPieces = items.filter((i) => pieceSupportsBuild(i, focus)).length;
  const buildOverlaps = findBuildOverlapClusters(buckets, focus);
  const redundantOverlap =
    supportingPieces >= 8 && slotsCovered < 5 && buildOverlaps.length > 0;

  return {
    build,
    recommendedLoadout,
    loadoutVerdict,
    statAchievability,
    slotsCovered,
    slotCoverage,
    loadoutComplete,
    targetsMet,
    statsComfortable,
    setBonusReadiness,
    buildReady,
    gaps: findCoverageGaps(buckets, focus),
    overlaps: buildOverlaps.length > 0 ? buildOverlaps : findOverlapClusters(buckets),
    filledProfiles,
    possibleProfiles: countPossibleProfiles(),
    supportingPieces,
    redundantOverlap,
  };
}

export function analyzeDesiredBuilds(
  items: ArmorPiece[],
  buckets: DupeBucket[],
  prefs: ClassPreferenceProfile,
  classType: ClassType,
): CoverageAnalysis[] {
  return getDesiredBuilds(prefs, classType).map((desired) =>
    analyzeCoverage(items, buckets, resolveDesiredBuild(desired, prefs)),
  );
}

export function analyzeBuildBalance(analyses: CoverageAnalysis[]): BuildBalanceInsight[] {
  return analyses.map((a) => {
    const overlapRisk = a.redundantOverlap;
    const coverageGap = !a.loadoutComplete && a.supportingPieces < 5;
    return {
      buildId: a.build.desiredBuildId ?? a.build.id,
      label: a.build.label,
      slotsCovered: a.slotsCovered,
      supportingPieces: a.supportingPieces,
      loadoutComplete: a.loadoutComplete,
      overlapRisk,
      coverageGap,
    };
  });
}

export function formatSlotCoverageLabel(slot: ArmorSlot, covered: boolean): string {
  return `${SLOT_LABELS[slot]} — ${covered ? 'covered' : 'gap'}`;
}
