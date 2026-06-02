import {
  ARCHETYPE_LABELS,
  ARCHETYPE_STATS,
  ARMOR_SLOTS,
  SLOT_LABELS,
  STAT_LABELS,
  STATS,
} from '@/lib/constants';
import { MASTERWORK_STAT_BONUS } from '@/lib/armor/effectiveStats';
import { intrinsicStats } from '@/lib/armor/intrinsicCompare';
import {
  computeOptimalRollShapes,
  formatBuildVerdict,
  isBestTierLoadoutPiece,
  pieceTuningFit,
  priorityStatsFromTargets,
  T5_CANONICAL_PRIMARY,
  T5_CANONICAL_SECONDARY,
  T5_CANONICAL_TERTIARY,
  T5_TUNING_INTRINSIC_SHIFT,
  tuningFitScore,
  type BuildVerdict,
} from '@/lib/coverage/achievability';
import type { Archetype, ArmorPiece, ArmorSlot, Stat, StatTarget } from '@/types';
import type { BuildProfile } from '@/lib/coverage/builds';
import {
  parseSetBonusTargets,
  resolveSetName,
  setPreferenceScore,
  type SetBonusTarget,
} from '@/lib/coverage/setBonus';

/**
 * ## Combo grid spec — set-bonus combos (2+2 mix)
 *
 * ### A. Column identity
 * Each column = **roll pattern** (archetype + tertiary + tuning) × **armor set** (when set bonus
 * configured). Column key: `patternSetColumnKey(patternKey, setHash)`.
 *
 * ### B. Piece eligibility (per column, per slot)
 * A piece may appear in a column slot picker or auto-pick when ALL hold:
 * - **Hard:** `piece.tuningStat === pattern.tuningStat`
 * - **Hard:** `piece.armorSet.hash === setHash` when the column is set-scoped
 * - **Hard:** `pieceLoadoutContribution(piece, priorities) > 0` for set columns
 * - **Exact match:** full roll pattern + `isBestTierLoadoutPiece` — preferred auto-pick
 * - **Set column (shape match):** archetype + tertiary + tuning must match the column pattern;
 *   `pieceLoadoutContribution > 0`; best-tier not required. Enforced in
 *   {@link pieceEligibleForSetPatternColumnSlot}.
 *
 * ### C. Red exclusive badge (global ambiguity rule)
 * Scope is the full visible grid for the active combo/build:
 * - set-enabled: `{ setHash, slot }`
 * - no-set: `{ slot }`
 * Gold shows only when exactly one qualifying top candidate exists in scope.
 * If two or more candidates qualify in scope, all matching badges stay cyan (no red exclusive).
 *
 * ### D. Duplicate prevention
 * The same `instanceId` must not appear in two columns whose `pattern.tuningStat` differs.
 * Eligibility hard-gates tuning per column; a piece cannot satisfy both weapons and grenade tuning.
 *
 * ### E. Empty slot copy
 * {@link formatEmptyPatternSlotMessage} — one flowing line aligned with the column header
 * (pattern context · optional set · slot name).
 */
export interface ColumnSlotContext {
  pattern: OptimalRollPattern;
  priorities: Stat[];
  setHash?: number;
  setName?: string;
  setTargets?: SetBonusTarget[];
}

/** Build column context from pattern loadout column metadata. */
export function columnSlotContextFromColumn(
  pattern: OptimalRollPattern,
  priorities: Stat[],
  setHash?: number,
  setName?: string,
  setTargets: SetBonusTarget[] = [],
): ColumnSlotContext {
  return { pattern, priorities, setHash, setName, setTargets };
}

export interface EligibleLoadoutPiece {
  piece: ArmorPiece;
  contributionScore: number;
  /** Brief label for why this piece matches build priorities. */
  fitLabel: string;
}

/** Intrinsic roll + masterwork (+2 per rolled line), always assumed for build math. */
function assumedMasterworkStats(item: ArmorPiece): Partial<Record<Stat, number>> {
  const roll = intrinsicStats(item);
  const out: Partial<Record<Stat, number>> = {};
  for (const stat of STATS) {
    const val = roll[stat] ?? 0;
    if (val > 0) out[stat] = val + MASTERWORK_STAT_BONUS;
  }
  return out;
}

export interface SlotLoadoutEntry {
  slot: ArmorSlot;
  piece: ArmorPiece | null;
  /** Combined priority contribution score for this pick. */
  contributionScore: number;
}

export interface RecommendedLoadout {
  slots: SlotLoadoutEntry[];
  /** Non-null pieces in slot order. */
  pieces: ArmorPiece[];
  slotsFilled: number;
}

export interface LoadoutVerdict {
  verdict: BuildVerdict;
  slotsFilled: number;
  slotsTotal: number;
  summary: string;
}

/** Priority rank weight: first stat weighs most. */
function priorityWeight(rank: number, total: number): number {
  return total - rank;
}

/**
 * How well one piece contributes to maximizing a priority stat set together.
 * Uses MW-assumed stat values plus tuning alignment; rewards stacking multiple priorities.
 */
export function pieceLoadoutContribution(
  item: ArmorPiece,
  priorities: Stat[],
): number {
  if (priorities.length === 0) return 0;

  const mw = assumedMasterworkStats(item);
  let score = 0;
  let statsHit = 0;

  for (let i = 0; i < priorities.length; i++) {
    const stat = priorities[i];
    const fit = pieceTuningFit(item, stat);
    if (fit.level === 'none') continue;

    statsHit++;
    const weight = priorityWeight(i, priorities.length);
    score += (mw[stat] ?? 0) * weight * 10;
    score += tuningFitScore(fit.level) * weight * 25;
  }

  if (statsHit === 0) return 0;
  if (statsHit >= 2) {
    score *= 1 + 0.15 * (statsHit - 1);
  }
  return score;
}

export interface OptimalRollPattern {
  archetype: Archetype | null;
  tertiaryStat: Stat;
  tuningStat: Stat;
  /** Priority stat on tertiary for this shape. */
  idealStat: Stat;
  /** Compact plain-text label (aria, empty-slot copy). */
  label: string;
}

/** Stable key for persistence: `archetype:tertiary:tuning` (`any` when archetype is open). */
export function optimalRollPatternKey(
  pattern: Pick<OptimalRollPattern, 'archetype' | 'tertiaryStat' | 'tuningStat'>,
): string {
  const archetype = pattern.archetype ?? 'any';
  return `${archetype}:${pattern.tertiaryStat}:${pattern.tuningStat}`;
}

/** Persistence key for a roll-pattern column scoped to one target armor set. */
export function patternSetColumnKey(patternKey: string, setHash: number): string {
  return `${patternKey}:${setHash}`;
}

/** Whether a vault piece matches a concrete optimal roll pattern. */
export function pieceMatchesRollPattern(
  item: ArmorPiece,
  pattern: OptimalRollPattern,
): boolean {
  if (item.tertiaryStat !== pattern.tertiaryStat) return false;
  if (item.tuningStat !== pattern.tuningStat) return false;
  if (pattern.archetype !== null && item.archetype !== pattern.archetype) return false;
  return true;
}

/**
 * Near match: set (when scoped), slot, archetype, and tertiary match the column pattern
 * but tuning differs. Wrong set or archetype pieces are excluded.
 */
export function pieceMatchesNearRollPattern(
  item: ArmorPiece,
  pattern: OptimalRollPattern,
): boolean {
  if (item.tertiaryStat !== pattern.tertiaryStat) return false;
  if (pattern.archetype !== null && item.archetype !== pattern.archetype) return false;
  if (item.tuningStat === pattern.tuningStat) return false;
  return true;
}

/** Tooltip for a near-match piece shown dimmed in the combo grid. */
export function formatNearMatchTooltip(
  item: ArmorPiece,
  pattern: OptimalRollPattern,
): string {
  const expected = STAT_LABELS[pattern.tuningStat];
  const actual = item.tuningStat ? STAT_LABELS[item.tuningStat] : 'none';
  return `Wrong tuning — has ${actual}, need ${expected}`;
}

/** Label for acceptable tuning on multi-priority builds (any priority stat). */
export function formatPriorityTuningLabel(priorities: Stat[]): string {
  const names = priorities.map((stat) => STAT_LABELS[stat]);
  if (names.length === 1) return `${names[0]} tuning`;
  if (names.length === 2) return `${names[0]} or ${names[1]} tuning`;
  return `${names.slice(0, -1).join(', ')}, or ${names[names.length - 1]} tuning`;
}

/** UI/pattern labels: tertiary roll line (+20). Not {@link T5_CANONICAL_TUNING_BONUS}. */
export const OPTIMAL_ROLL_TERTIARY_BONUS = T5_CANONICAL_TERTIARY;
/** UI/pattern labels: tuning socket shift (+5). Scoring worn totals use {@link T5_CANONICAL_TUNING_BONUS}. */
export const OPTIMAL_ROLL_TUNING_BONUS = T5_TUNING_INTRINSIC_SHIFT;

export function formatRollStatBonusLabel(stat: Stat, role: 'tertiary' | 'tuning'): string {
  const bonus = role === 'tertiary' ? OPTIMAL_ROLL_TERTIARY_BONUS : OPTIMAL_ROLL_TUNING_BONUS;
  return `${STAT_LABELS[stat]} +${bonus}`;
}

export type RollStatRole = 'tertiary' | 'tuning' | 'combined';

export interface RollPatternStatBonus {
  stat: Stat;
  totalBonus: number;
  /** True when tertiary (+20) and tuning (+5) stack on the same stat. */
  combined: boolean;
  role: RollStatRole;
}

/** Display chips/labels for a pattern's tertiary and tuning — merged when same stat. */
export function rollPatternStatBonuses(
  tertiaryStat: Stat,
  tuningStat: Stat,
  options?: { forceSplit?: boolean },
): RollPatternStatBonus[] {
  if (!options?.forceSplit && tertiaryStat === tuningStat) {
    return [
      {
        stat: tertiaryStat,
        totalBonus: OPTIMAL_ROLL_TERTIARY_BONUS + OPTIMAL_ROLL_TUNING_BONUS,
        combined: true,
        role: 'combined',
      },
    ];
  }
  if (tertiaryStat === tuningStat) {
    return [
      {
        stat: tertiaryStat,
        totalBonus: OPTIMAL_ROLL_TERTIARY_BONUS,
        combined: false,
        role: 'tertiary',
      },
      {
        stat: tuningStat,
        totalBonus: OPTIMAL_ROLL_TUNING_BONUS,
        combined: false,
        role: 'tuning',
      },
    ];
  }
  return [
    {
      stat: tertiaryStat,
      totalBonus: OPTIMAL_ROLL_TERTIARY_BONUS,
      combined: false,
      role: 'tertiary',
    },
    {
      stat: tuningStat,
      totalBonus: OPTIMAL_ROLL_TUNING_BONUS,
      combined: false,
      role: 'tuning',
    },
  ];
}

export interface ArchetypePriorityIntrinsic {
  stat: Stat;
  bonus: number;
}

/** Canonical archetype intrinsics that apply toward build priority stats. */
export function archetypePriorityIntrinsics(
  archetype: Archetype,
  priorities: Stat[],
): ArchetypePriorityIntrinsic[] {
  const [primary, secondary] = ARCHETYPE_STATS[archetype];
  const intrinsics: ArchetypePriorityIntrinsic[] = [];
  if (priorities.includes(primary)) {
    intrinsics.push({ stat: primary, bonus: T5_CANONICAL_PRIMARY });
  }
  if (priorities.includes(secondary)) {
    intrinsics.push({ stat: secondary, bonus: T5_CANONICAL_SECONDARY });
  }
  return intrinsics;
}

/** Sum of canonical archetype intrinsics on build priority stats (excludes tertiary/tuning). */
export function archetypePriorityIntrinsicTotal(
  archetype: Archetype,
  priorities: Stat[],
): number {
  return archetypePriorityIntrinsics(archetype, priorities).reduce(
    (total, { bonus }) => total + bonus,
    0,
  );
}

/** Archetype group header — name only; roll details appear on stat chips. */
export function formatArchetypeGroupLabel(archetype: Archetype, _priorities: Stat[]): string {
  return ARCHETYPE_LABELS[archetype];
}

/** Archetype secondary stat when it is not a build priority (shown muted in pattern UI). */
export function archetypeIrrelevantSecondary(
  archetype: Archetype,
  priorities: Stat[],
): Stat | null {
  const [, secondary] = ARCHETYPE_STATS[archetype];
  return priorities.includes(secondary) ? null : secondary;
}

/** Roll-line fragment: e.g. "Weapons tertiary", "Super tuning", "Weapons tertiary + tuning". */
export function formatRollStatRoleLabel(stat: Stat, role: RollStatRole): string {
  const name = STAT_LABELS[stat];
  if (role === 'combined') return `${name} tertiary + tuning`;
  if (role === 'tertiary') return `${name} tertiary`;
  return `${name} tuning`;
}

/** Tertiary + tuning roll line for a pattern (plain text). */
export function formatPatternRollLine(tertiaryStat: Stat, tuningStat: Stat): string {
  return rollPatternStatBonuses(tertiaryStat, tuningStat)
    .map(({ stat, role }) => formatRollStatRoleLabel(stat, role))
    .join(' · ');
}

/** Priority archetype stats + irrelevant secondary for a pattern (plain text). */
export function formatArchetypeRollContext(archetype: Archetype, priorities: Stat[]): string {
  const parts: string[] = [];
  for (const { stat } of archetypePriorityIntrinsics(archetype, priorities)) {
    parts.push(STAT_LABELS[stat]);
  }
  const irrelevant = archetypeIrrelevantSecondary(archetype, priorities);
  if (irrelevant) parts.push(STAT_LABELS[irrelevant]);
  return parts.join(' · ');
}

/** One-line label for an optimal roll shape (archetype context + tertiary + tuning). */
export function formatOptimalRollPatternLabel(
  archetype: Archetype | null,
  tertiaryStat: Stat,
  tuningStat: Stat,
  priorities: Stat[] = [],
): string {
  const rollLine = formatPatternRollLine(tertiaryStat, tuningStat);

  if (archetype === null) {
    return `Any · ${rollLine}`;
  }

  const context = formatArchetypeRollContext(archetype, priorities);
  return context
    ? `${ARCHETYPE_LABELS[archetype]} · ${context} · ${rollLine}`
    : `${ARCHETYPE_LABELS[archetype]} · ${rollLine}`;
}

/** Plain-text archetype legend for multi-priority optimal-roll banners. */
export function formatOptimalRollArchetypeLegend(archetypes: Archetype[]): string {
  const unique = [...new Set(archetypes)];
  return unique
    .map((archetype) => {
      const [primary, secondary] = ARCHETYPE_STATS[archetype];
      return `${ARCHETYPE_LABELS[archetype]} adds ${STAT_LABELS[primary]} and ${STAT_LABELS[secondary]}`;
    })
    .join(' · ');
}

/**
 * Intro line when a build has multiple priorities — clarifies each listed shape
 * still covers the full build and any slot can use any shape.
 */
export function formatOptimalRollBannerIntro(priorities: Stat[]): string {
  if (priorities.length <= 1) return '';
  const names = priorities.map((s) => STAT_LABELS[s]).join(' and ');
  return `Any slot — each pattern below covers ${names}.`;
}

export interface EmptyPatternMessageOptions {
  /** Build priority stats — archetype chip context in column headers. */
  priorities?: Stat[];
  /** Armor set name when the column is set-scoped. */
  setName?: string;
}

/** Strip trailing " Set" for compact empty-slot copy. */
function compactSetLabelForMessage(setName: string): string {
  return setName.replace(/\s+Set$/i, '');
}

/**
 * Roll-pattern identity aligned with {@link formatPatternRollLine} column headers:
 * archetype title (when fixed) + tertiary/tuning chips.
 */
export function formatEmptyPatternRollContext(
  pattern: OptimalRollPattern,
  priorities: Stat[] = [],
): string {
  const rollLine = formatPatternRollLine(pattern.tertiaryStat, pattern.tuningStat);
  if (pattern.archetype === null) {
    return rollLine;
  }
  return `${formatArchetypeGroupLabel(pattern.archetype, priorities)} · ${rollLine}`;
}

/** Empty per-slot hunt hint inside a roll-pattern column (single flowing line). */
export function formatEmptyPatternSlotMessage(
  slot: ArmorSlot,
  pattern: OptimalRollPattern,
  options: EmptyPatternMessageOptions = {},
): string {
  const { priorities = [], setName } = options;
  const slotLabel = SLOT_LABELS[slot].toLowerCase();
  const parts = [`No ${formatEmptyPatternRollContext(pattern, priorities)}`];
  if (setName) {
    parts.push(compactSetLabelForMessage(setName));
  }
  parts.push(slotLabel);
  return parts.join(' · ');
}

/** Empty column hint when no vault piece matches this roll pattern in any slot. */
export function formatEmptyPatternColumnMessage(
  pattern: OptimalRollPattern,
  options: EmptyPatternMessageOptions = {},
): string {
  const { priorities = [], setName } = options;
  const parts = [`Need ${formatEmptyPatternRollContext(pattern, priorities)}`];
  if (setName) {
    parts.push(compactSetLabelForMessage(setName));
  }
  return parts.join(' · ');
}

/**
 * Best-tier roll shapes to hunt for a priority list — mirrors `isBestTierLoadoutPiece`.
 *
 * Single priority: tertiary + tuning on that stat (any archetype).
 * Multi priority: each max-budget shape × each valid priority tuning stat.
 */
export function deriveOptimalRollPatterns(priorities: Stat[]): OptimalRollPattern[] {
  if (priorities.length === 0) return [];

  if (priorities.length === 1) {
    const stat = priorities[0];
    return [
      {
        archetype: null,
        tertiaryStat: stat,
        tuningStat: stat,
        idealStat: stat,
        label: formatOptimalRollPatternLabel(null, stat, stat, priorities),
      },
    ];
  }

  const patterns: OptimalRollPattern[] = [];
  for (const { archetype, tertiaryStat } of computeOptimalRollShapes(priorities)) {
    for (const tuningStat of priorities) {
      patterns.push({
        archetype,
        tertiaryStat,
        tuningStat,
        idealStat: tertiaryStat,
        label: formatOptimalRollPatternLabel(archetype, tertiaryStat, tuningStat, priorities),
      });
    }
  }
  return patterns;
}

/** One-line roll identity for loadout rows, banners, and aria labels. */
export function formatPieceRollSummary(item: ArmorPiece): string {
  const parts = [
    ARCHETYPE_LABELS[item.archetype],
    `${STAT_LABELS[item.tertiaryStat]} tertiary`,
  ];
  if (item.tuningStat) {
    parts.push(`${STAT_LABELS[item.tuningStat]} tuning`);
  }
  return parts.join(' · ');
}

/** @deprecated Alias for {@link formatPieceRollSummary}. */
export function formatPieceRollDescriptor(item: ArmorPiece): string {
  return formatPieceRollSummary(item);
}

function formatPrioritySupportLabel(stat: Stat, fit: ReturnType<typeof pieceTuningFit>): string {
  const name = STAT_LABELS[stat];
  if (fit.level === 'ideal') return `${name} via tertiary + tuning`;
  if (fit.tuningMatch) return `${name} via tuning`;
  if (fit.tertiaryMatch) return `${name} via tertiary`;
  if (fit.intrinsicMatch) return `${name} from archetype`;
  return name;
}

/**
 * One-line summary: piece roll, then how each build priority is supported.
 * Priorities use tuning/tertiary/archetype — not separate tuning stats on the piece.
 */
export function formatPieceLoadoutFitLabel(item: ArmorPiece, priorities: Stat[]): string {
  const roll = formatPieceRollSummary(item);
  const supports: string[] = [];
  for (const stat of priorities) {
    const fit = pieceTuningFit(item, stat);
    if (fit.level === 'none') continue;
    supports.push(formatPrioritySupportLabel(stat, fit));
  }
  if (supports.length === 0) return `${roll} · No combo fit`;
  return `${roll} · ${supports.join(' · ')}`;
}

function pieceEligibleForLoadout(item: ArmorPiece, priorities: Stat[]): boolean {
  return isBestTierLoadoutPiece(item, priorities);
}

function pieceEligibleForSetQuota(
  item: ArmorPiece,
  priorities: Stat[],
  setTargets: SetBonusTarget[],
): boolean {
  if (setTargets.length === 0) return false;
  const hash = item.armorSet?.hash;
  if (hash === undefined || !setTargets.some((t) => t.hash === hash)) return false;
  return pieceLoadoutContribution(item, priorities) > 0;
}

function loadoutCandidatesForSlot(
  items: ArmorPiece[],
  slot: ArmorSlot,
  priorities: Stat[],
  setTargets: SetBonusTarget[] = [],
): ArmorPiece[] {
  const seen = new Set<string>();
  const out: ArmorPiece[] = [];
  for (const item of items) {
    if (item.armorSlot !== slot) continue;
    const eligible =
      isBestTierLoadoutPiece(item, priorities) ||
      pieceEligibleForSetQuota(item, priorities, setTargets);
    if (!eligible || seen.has(item.instanceId)) continue;
    seen.add(item.instanceId);
    out.push(item);
  }
  return out;
}

/** All vault pieces in a slot that roll at least one priority stat, best fit first. */
export function rankEligiblePiecesForSlot(
  items: ArmorPiece[],
  slot: ArmorSlot,
  priorities: Stat[],
  setTargets: SetBonusTarget[] = [],
): EligibleLoadoutPiece[] {
  return items
    .filter((i) => i.armorSlot === slot && pieceEligibleForLoadout(i, priorities))
    .map((piece) => ({
      piece,
      contributionScore: pieceLoadoutContribution(piece, priorities),
      fitLabel: formatPieceLoadoutFitLabel(piece, priorities),
    }))
    .sort((a, b) => compareLoadoutPieces(a.piece, b.piece, priorities, setTargets));
}

function compareLoadoutPieces(
  a: ArmorPiece,
  b: ArmorPiece,
  priorities: Stat[],
  setTargets: SetBonusTarget[] = [],
  currentSetCounts?: ReadonlyMap<number, number>,
): number {
  const scoreDiff =
    pieceLoadoutContribution(b, priorities) - pieceLoadoutContribution(a, priorities);
  if (scoreDiff !== 0) return scoreDiff;

  const setPrefDiff =
    setPreferenceScore(b, setTargets, currentSetCounts) -
    setPreferenceScore(a, setTargets, currentSetCounts);
  if (setPrefDiff !== 0) return setPrefDiff;

  const wantDiff = (b.wantScore ?? 0) - (a.wantScore ?? 0);
  if (wantDiff !== 0) return wantDiff;

  const tierDiff = (b.tier ?? 0) - (a.tier ?? 0);
  if (tierDiff !== 0) return tierDiff;

  if (Boolean(b.isMasterwork) !== Boolean(a.isMasterwork)) {
    return b.isMasterwork ? 1 : -1;
  }

  const powerDiff = b.power - a.power;
  if (powerDiff !== 0) return powerDiff;

  const setA = a.armorSet?.name ?? '';
  const setB = b.armorSet?.name ?? '';
  return setA.localeCompare(setB);
}

/** Picker display order: pinned selected piece first, then algorithm rank. */
export function orderEligiblePiecesForSlotPicker(
  ranked: EligibleLoadoutPiece[],
  selectedInstanceId?: string,
): EligibleLoadoutPiece[] {
  if (!selectedInstanceId || ranked.length <= 1) return ranked;

  const selectedIndex = ranked.findIndex(
    ({ piece }) => piece.instanceId === selectedInstanceId,
  );
  if (selectedIndex <= 0) return ranked;

  const selected = ranked[selectedIndex]!;
  const rest = ranked.filter((_, index) => index !== selectedIndex);
  return [selected, ...rest];
}

function bestPieceForSlot(
  items: ArmorPiece[],
  slot: ArmorSlot,
  priorities: Stat[],
  setTargets: SetBonusTarget[] = [],
): SlotLoadoutEntry {
  const candidates = loadoutCandidatesForSlot(items, slot, priorities, setTargets);
  if (candidates.length === 0) {
    return { slot, piece: null, contributionScore: 0 };
  }

  const best = candidates.reduce((best, item) =>
    compareLoadoutPieces(best, item, priorities, setTargets) > 0 ? item : best,
  );
  const contributionScore = pieceLoadoutContribution(best, priorities);

  return {
    slot,
    piece: best,
    contributionScore,
  };
}

const SET_QUOTA_MET_BONUS = 50_000;
const SET_QUOTA_PIECE_BONUS = 5_000;
const SET_QUOTA_OVERFLOW_PENALTY = 100_000;

function scoreLoadoutAssignment(
  pieces: (ArmorPiece | null)[],
  priorities: Stat[],
  quotas: SetBonusTarget[],
): number {
  let score = 0;
  for (const piece of pieces) {
    if (piece) score += pieceLoadoutContribution(piece, priorities);
  }
  if (quotas.length === 0) return score;

  const counts = new Map<number, number>();
  for (const piece of pieces) {
    const hash = piece?.armorSet?.hash;
    if (hash !== undefined) {
      counts.set(hash, (counts.get(hash) ?? 0) + 1);
    }
  }
  for (const quota of quotas) {
    const have = counts.get(quota.hash) ?? 0;
    if (have >= quota.pieces) {
      score += SET_QUOTA_MET_BONUS;
      if (have > quota.pieces) {
        score -= (have - quota.pieces) * SET_QUOTA_OVERFLOW_PENALTY;
      }
    } else {
      score += have * SET_QUOTA_PIECE_BONUS;
    }
  }
  return score;
}

function selectBestLoadoutAssignment(
  items: ArmorPiece[],
  priorities: Stat[],
  quotas: SetBonusTarget[],
): (ArmorPiece | null)[] {
  const candidatesBySlot = ARMOR_SLOTS.map((slot) =>
    loadoutCandidatesForSlot(items, slot, priorities, quotas),
  );

  let bestScore = -Infinity;
  let bestAssignment: (ArmorPiece | null)[] = ARMOR_SLOTS.map(() => null);

  function assign(slotIndex: number, chosen: (ArmorPiece | null)[]) {
    if (slotIndex === ARMOR_SLOTS.length) {
      const score = scoreLoadoutAssignment(chosen, priorities, quotas);
      if (score > bestScore) {
        bestScore = score;
        bestAssignment = [...chosen];
      }
      return;
    }

    assign(slotIndex + 1, [...chosen, null]);
    for (const piece of candidatesBySlot[slotIndex]!) {
      assign(slotIndex + 1, [...chosen, piece]);
    }
  }

  assign(0, []);
  return bestAssignment;
}

export type SlotLoadoutSource = 'representative' | 'auto';

export interface ResolvedSlotLoadout {
  piece: ArmorPiece | null;
  source: SlotLoadoutSource;
}

/** Whether a saved instance id is still a best-tier fit for this slot and build. */
export function isValidSlotRepresentative(
  items: ArmorPiece[],
  slot: ArmorSlot,
  instanceId: string,
  priorities: Stat[],
): boolean {
  const item = items.find((i) => i.instanceId === instanceId);
  if (!item) return false;
  return item.armorSlot === slot && isBestTierLoadoutPiece(item, priorities);
}

/** Use a saved representative when valid; otherwise fall back to the algorithm pick. */
export function resolveSlotLoadoutPiece(
  items: ArmorPiece[],
  slot: ArmorSlot,
  priorities: Stat[],
  autoPiece: ArmorPiece | null,
  representativeId?: string,
): ResolvedSlotLoadout {
  if (
    representativeId &&
    isValidSlotRepresentative(items, slot, representativeId, priorities)
  ) {
    const piece = items.find((i) => i.instanceId === representativeId)!;
    return { piece, source: 'representative' };
  }
  return { piece: autoPiece, source: 'auto' };
}

/** Pick the best vault piece per slot to maximize the combined priority stat set. */
export function selectRecommendedLoadout(
  items: ArmorPiece[],
  targets: StatTarget[],
  setBonuses?: Pick<BuildProfile, 'setBonus2pc' | 'setBonus4pc'>,
): RecommendedLoadout {
  const priorities = priorityStatsFromTargets(targets);
  const quotas = parseSetBonusTargets(setBonuses?.setBonus2pc, setBonuses?.setBonus4pc);

  const slots: SlotLoadoutEntry[] =
    quotas.length === 0
      ? ARMOR_SLOTS.map((slot) => bestPieceForSlot(items, slot, priorities))
      : (() => {
          const assignment = selectBestLoadoutAssignment(items, priorities, quotas);
          return ARMOR_SLOTS.map((slot, index) => {
            const piece = assignment[index] ?? null;
            return {
              slot,
              piece,
              contributionScore: piece ? pieceLoadoutContribution(piece, priorities) : 0,
            };
          });
        })();

  const pieces = slots.flatMap((entry) => (entry.piece ? [entry.piece] : []));
  return {
    slots,
    pieces,
    slotsFilled: pieces.length,
  };
}

export function loadoutVerdictFromLoadout(loadout: RecommendedLoadout): LoadoutVerdict {
  const slotsTotal = ARMOR_SLOTS.length;
  const slotsFilled = loadout.slotsFilled;

  let verdict: BuildVerdict;
  if (slotsFilled === 0) {
    verdict = 'need_rolls';
  } else if (slotsFilled === slotsTotal) {
    verdict = 'ready';
  } else {
    verdict = 'almost';
  }

  const summary = formatLoadoutVerdictSummary(slotsFilled, slotsTotal);
  return { verdict, slotsFilled, slotsTotal, summary };
}

/** Short slot coverage for banners and build tabs (Ready vs 3 of 5). */
export function formatLoadoutSlotStatus({
  verdict,
  slotsFilled,
  slotsTotal,
}: LoadoutVerdict): string {
  if (slotsFilled === slotsTotal && slotsTotal > 0) {
    return formatBuildVerdict(verdict);
  }
  if (slotsFilled === 0) {
    return formatBuildVerdict(verdict);
  }
  return `${slotsFilled} of ${slotsTotal}`;
}

export function formatLoadoutVerdictSummary(
  slotsFilled: number,
  slotsTotal = ARMOR_SLOTS.length,
): string {
  if (slotsFilled === 0) {
    return 'No vault pieces roll your priority stats yet.';
  }
  if (slotsFilled === slotsTotal) {
    return `Complete loadout — best piece per slot (${slotsTotal}/${slotsTotal}).`;
  }
  const emptySlots = slotsTotal - slotsFilled;
  return `${slotsFilled}/${slotsTotal} slots filled · ${emptySlots} slot${emptySlots === 1 ? '' : 's'} still need a fit.`;
}

export function analyzeRecommendedLoadout(
  items: ArmorPiece[],
  targets: StatTarget[],
  setBonuses?: Pick<BuildProfile, 'setBonus2pc' | 'setBonus4pc'>,
): {
  loadout: RecommendedLoadout;
  loadoutVerdict: LoadoutVerdict;
} {
  const loadout = selectRecommendedLoadout(items, targets, setBonuses);
  const loadoutVerdict = loadoutVerdictFromLoadout(loadout);
  return { loadout, loadoutVerdict };
}

/** Build priority stats that can appear as tuning on best-tier pieces (2–4). */
export function viableTuningStats(priorities: Stat[]): Stat[] {
  return priorities;
}

export interface PatternLoadoutEntry {
  pattern: OptimalRollPattern;
  patternKey: string;
  /** Persistence and grid key; equals patternKey without set bonus, else patternSetColumnKey. */
  columnKey: string;
  /** Target armor set when combo has set bonus columns. */
  setHash?: number;
  setName?: string;
  piece: ArmorPiece | null;
  contributionScore: number;
}

/** @deprecated Use PatternLoadoutEntry */
export type TuningLoadoutEntry = PatternLoadoutEntry;

export interface RecommendedPatternLoadout {
  columns: PatternLoadoutEntry[];
  columnsFilled: number;
  columnsTotal: number;
}

/** @deprecated Use RecommendedPatternLoadout */
export type RecommendedTuningLoadout = RecommendedPatternLoadout;

/** Best-tier piece matching the full roll pattern (archetype + tertiary + tuning). */
export function pieceEligibleForPatternColumn(
  item: ArmorPiece,
  pattern: OptimalRollPattern,
  priorities: Stat[],
): boolean {
  return (
    pieceMatchesRollPattern(item, pattern) &&
    isBestTierLoadoutPiece(item, priorities)
  );
}

/** @deprecated Use pieceEligibleForPatternColumn */
export function pieceEligibleForTuningColumn(
  item: ArmorPiece,
  tuningStat: Stat,
  priorities: Stat[],
): boolean {
  return item.tuningStat === tuningStat && isBestTierLoadoutPiece(item, priorities);
}

/** All vault pieces matching this roll pattern, best fit first. */
export function rankEligiblePiecesForPattern(
  items: ArmorPiece[],
  pattern: OptimalRollPattern,
  priorities: Stat[],
  setTargets: SetBonusTarget[] = [],
): EligibleLoadoutPiece[] {
  return items
    .filter((i) => pieceEligibleForPatternColumn(i, pattern, priorities))
    .map((piece) => ({
      piece,
      contributionScore: pieceLoadoutContribution(piece, priorities),
      fitLabel: formatPieceLoadoutFitLabel(piece, priorities),
    }))
    .sort((a, b) => compareLoadoutPieces(a.piece, b.piece, priorities, setTargets));
}

/** @deprecated Use rankEligiblePiecesForPattern */
export function rankEligiblePiecesForTuningStat(
  items: ArmorPiece[],
  tuningStat: Stat,
  priorities: Stat[],
): EligibleLoadoutPiece[] {
  return items
    .filter((i) => pieceEligibleForTuningColumn(i, tuningStat, priorities))
    .map((piece) => ({
      piece,
      contributionScore: pieceLoadoutContribution(piece, priorities),
      fitLabel: formatPieceLoadoutFitLabel(piece, priorities),
    }))
    .sort((a, b) => compareLoadoutPieces(a.piece, b.piece, priorities));
}

export type PatternSlotMatchTier = 'perfect' | 'near';

export interface PatternSlotLoadoutEntry {
  slot: ArmorSlot;
  piece: ArmorPiece | null;
  /** `null` when slot is empty; `near` when only wrong-tuning fallback is shown. */
  matchTier: PatternSlotMatchTier | null;
  contributionScore: number;
}

/** @deprecated Use PatternSlotLoadoutEntry */
export type TuningSlotLoadoutEntry = PatternSlotLoadoutEntry;

function pieceMatchesSetColumnFilter(piece: ArmorPiece, setHash?: number): boolean {
  return setHash === undefined || piece.armorSet?.hash === setHash;
}

/** Rank-1 eligible piece in a column slot — used for column-scoped red exclusive badge. */
export function topGoldColumnPiece(
  items: readonly ArmorPiece[],
  slot: ArmorSlot,
  ctx: ColumnSlotContext,
): ArmorPiece | null {
  const eligible = columnSlotEligiblePieces(items, slot, ctx);
  if (eligible.length === 0) return null;
  const { pattern, priorities, setTargets = [] } = ctx;
  return eligible.reduce((best, item) =>
    comparePatternSlotCandidates(best, item, pattern, priorities, setTargets) > 0 ? item : best,
  );
}

export interface SetPatternColumnDescriptor {
  columnKey: string;
  pattern: OptimalRollPattern;
  setHash?: number;
  setName?: string;
}

function scopeSlotKey(setHash: number | undefined, slot: ArmorSlot): string {
  return setHash === undefined ? `no-set:${slot}` : `${setHash}:${slot}`;
}

/** Global set+slot winner instance id for a combo/build, independent of pattern column. */
export function globalSetSlotWinnerInstanceId(
  items: readonly ArmorPiece[],
  slot: ArmorSlot,
  setHash: number,
  priorities: Stat[],
  setTargets: SetBonusTarget[] = [],
): string | undefined {
  return bestSetPieceInSlot(items, slot, setHash, priorities, setTargets)?.instanceId;
}

/**
 * Determine the single column+slot cells that may render red exclusive badges.
 * Gold appears only for unambiguous scope winners (exactly one candidate).
 */
export function globalGoldBadgePlacementKeys(
  items: readonly ArmorPiece[],
  columns: readonly SetPatternColumnDescriptor[],
  priorities: Stat[],
  setTargets: SetBonusTarget[] = [],
): ReadonlySet<string> {
  const candidatesByScopeSlot = new Map<string, Set<string>>();
  for (const column of columns) {
    const ctx = columnSlotContextFromColumn(
      column.pattern,
      priorities,
      column.setHash,
      column.setName,
      setTargets,
    );
    for (const slot of ARMOR_SLOTS) {
      const top = topGoldColumnPiece(items, slot, ctx);
      if (!top) continue;
      const key = scopeSlotKey(column.setHash, slot);
      const candidateIds = candidatesByScopeSlot.get(key) ?? new Set<string>();
      candidateIds.add(top.instanceId);
      candidatesByScopeSlot.set(key, candidateIds);
    }
  }

  const unambiguousByScopeSlot = new Map<string, string>();
  for (const [scopeKey, candidateIds] of candidatesByScopeSlot) {
    if (candidateIds.size !== 1) continue;
    unambiguousByScopeSlot.set(scopeKey, [...candidateIds][0]!);
  }

  const placements = new Set<string>();
  const claimedScopeSlots = new Set<string>();
  for (const column of columns) {
    const bySlot = bestPiecesForPatternBySlot(
      [...items],
      column.pattern,
      priorities,
      setTargets,
      undefined,
      column.setHash,
      column.setName,
    );
    for (const entry of bySlot) {
      const key = scopeSlotKey(column.setHash, entry.slot);
      if (claimedScopeSlots.has(key)) continue;
      const winnerId = unambiguousByScopeSlot.get(key);
      if (winnerId && entry.matchTier === 'perfect' && entry.piece?.instanceId === winnerId) {
        placements.add(`${column.columnKey}|${entry.slot}`);
        claimedScopeSlots.add(key);
      }
    }
  }

  return placements;
}

/**
 * Count how many enabled builds would show a combo-eligibility badge for each piece.
 * A build contributes at most once per instance, even if multiple columns/slots match.
 */
export function countEligibleBuildBadgesByInstance(
  items: readonly ArmorPiece[],
  builds: readonly Pick<BuildProfile, 'statTargets' | 'setBonus2pc' | 'setBonus4pc'>[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();

  for (const build of builds) {
    const priorities = priorityStatsFromTargets(build.statTargets);
    const setTargets = parseSetBonusTargets(build.setBonus2pc, build.setBonus4pc);
    const columns = selectRecommendedPatternLoadout(items as ArmorPiece[], build.statTargets, {
      setBonus2pc: build.setBonus2pc,
      setBonus4pc: build.setBonus4pc,
    }).columns;
    const seenThisBuild = new Set<string>();

    for (const column of columns) {
      const ctx = columnSlotContextFromColumn(
        column.pattern,
        priorities,
        column.setHash,
        column.setName,
        setTargets,
      );
      for (const slot of ARMOR_SLOTS) {
        for (const piece of columnSlotEligiblePieces(items, slot, ctx)) {
          seenThisBuild.add(piece.instanceId);
        }
      }
    }

    for (const instanceId of seenThisBuild) {
      counts.set(instanceId, (counts.get(instanceId) ?? 0) + 1);
    }
  }

  return counts;
}

/** Red exclusive badge: rank-1 eligible piece for this column context (pattern + set + slot). */
export function isTopGoldColumnPiece(
  piece: ArmorPiece,
  ctx: ColumnSlotContext,
  items: readonly ArmorPiece[],
): boolean {
  if (!pieceMatchesSetColumnFilter(piece, ctx.setHash)) return false;
  if (!isColumnSlotEligiblePiece(piece, ctx)) return false;
  const top = topGoldColumnPiece(items, piece.armorSlot, ctx);
  return top?.instanceId === piece.instanceId;
}

/** Whether a piece is eligible in this column slot (may show cyan combo badge). */
export function isColumnSlotEligiblePiece(
  piece: ArmorPiece,
  ctx: ColumnSlotContext,
): boolean {
  return columnSlotEligiblePieces([piece], piece.armorSlot, ctx).length > 0;
}

export function formatTopGoldColumnTooltip(ctx: ColumnSlotContext, slot: ArmorSlot): string {
  const scopeLabel = ctx.setName ? compactSetLabelForMessage(ctx.setName) : 'combo';
  return `Best ${scopeLabel} ${SLOT_LABELS[slot].toLowerCase()} for this roll column`;
}

/** Vault pieces eligible for picker/auto-pick in one column slot. */
export function columnSlotEligiblePieces(
  items: readonly ArmorPiece[],
  slot: ArmorSlot,
  ctx: ColumnSlotContext,
): ArmorPiece[] {
  return items.filter(
    (item) =>
      item.armorSlot === slot &&
      pieceEligibleForSetPatternColumnSlot(
        item,
        ctx.pattern,
        ctx.priorities,
        ctx.setHash,
      ),
  );
}

/** How closely a piece matches a target roll pattern (higher = better). */
export function rollPatternMatchScore(
  item: ArmorPiece,
  pattern: OptimalRollPattern,
): number {
  let score = 0;
  if (pattern.archetype === null || item.archetype === pattern.archetype) {
    score += 4;
  }
  if (item.tertiaryStat === pattern.tertiaryStat) score += 2;
  if (item.tuningStat === pattern.tuningStat) score += 1;
  return score;
}

function pieceEligibleForSetPatternColumnSlot(
  item: ArmorPiece,
  pattern: OptimalRollPattern,
  priorities: Stat[],
  setHash?: number,
): boolean {
  if (!pieceMatchesSetColumnFilter(item, setHash)) return false;
  if (pieceEligibleForPatternColumn(item, pattern, priorities)) return true;
  if (setHash === undefined) return false;
  if (!pieceMatchesRollPattern(item, pattern)) return false;
  return pieceLoadoutContribution(item, priorities) > 0;
}

function pieceEligibleForNearPatternColumnSlot(
  item: ArmorPiece,
  pattern: OptimalRollPattern,
  priorities: Stat[],
  setHash?: number,
): boolean {
  if (!pieceMatchesSetColumnFilter(item, setHash)) return false;
  if (!pieceMatchesNearRollPattern(item, pattern)) return false;
  return pieceLoadoutContribution(item, priorities) > 0;
}

function nearPatternSlotCandidates(
  items: ArmorPiece[],
  slot: ArmorSlot,
  ctx: ColumnSlotContext,
): ArmorPiece[] {
  return items.filter(
    (item) =>
      item.armorSlot === slot &&
      pieceEligibleForNearPatternColumnSlot(
        item,
        ctx.pattern,
        ctx.priorities,
        ctx.setHash,
      ),
  );
}

/** Top-ranked vault piece from one armor set in a slot for combo stat priorities. */
export function bestSetPieceInSlot(
  items: readonly ArmorPiece[],
  slot: ArmorSlot,
  setHash: number,
  priorities: Stat[],
  setTargets: SetBonusTarget[] = [],
): ArmorPiece | null {
  const candidates = items.filter(
    (item) =>
      item.armorSlot === slot &&
      item.armorSet?.hash === setHash &&
      pieceLoadoutContribution(item, priorities) > 0,
  );
  if (candidates.length === 0) return null;

  return candidates.reduce((best, item) =>
    compareLoadoutPieces(best, item, priorities, setTargets) > 0 ? item : best,
  );
}

export function isBestSetPieceInSlotForCombo(
  piece: ArmorPiece,
  setHash: number,
  priorities: Stat[],
  items: readonly ArmorPiece[],
  setTargets: SetBonusTarget[] = [],
  pattern?: OptimalRollPattern,
  setName?: string,
): boolean {
  if (pattern === undefined) {
    const best = bestSetPieceInSlot(items, piece.armorSlot, setHash, priorities, setTargets);
    return best?.instanceId === piece.instanceId;
  }
  return isTopGoldColumnPiece(
    piece,
    columnSlotContextFromColumn(pattern, priorities, setHash, setName, setTargets),
    items,
  );
}

/** @deprecated Use {@link formatTopGoldColumnTooltip} */
export function formatBestSetPieceInSlotTooltip(
  setName: string,
  slot: ArmorSlot,
): string {
  return `Best ${compactSetLabelForMessage(setName)} ${SLOT_LABELS[slot].toLowerCase()} for this roll column`;
}

function comparePatternSlotCandidates(
  a: ArmorPiece,
  b: ArmorPiece,
  pattern: OptimalRollPattern,
  priorities: Stat[],
  setTargets: SetBonusTarget[] = [],
): number {
  const patternDiff = rollPatternMatchScore(b, pattern) - rollPatternMatchScore(a, pattern);
  if (patternDiff !== 0) return patternDiff;

  const exactDiff =
    Number(pieceEligibleForPatternColumn(b, pattern, priorities)) -
    Number(pieceEligibleForPatternColumn(a, pattern, priorities));
  if (exactDiff !== 0) return exactDiff;

  return compareLoadoutPieces(a, b, priorities, setTargets);
}

function patternSlotCandidates(
  items: ArmorPiece[],
  slot: ArmorSlot,
  ctx: ColumnSlotContext,
): ArmorPiece[] {
  return columnSlotEligiblePieces(items, slot, ctx);
}

function bestPieceForPatternInSlot(
  items: ArmorPiece[],
  slot: ArmorSlot,
  ctx: ColumnSlotContext,
  slotAssignment?: ReadonlyMap<ArmorSlot, ArmorPiece>,
): PatternSlotLoadoutEntry {
  const { pattern, priorities, setHash, setTargets = [] } = ctx;
  const hint = slotAssignment?.get(slot);
  if (
    hint &&
    pieceEligibleForSetPatternColumnSlot(hint, pattern, priorities, setHash)
  ) {
    return {
      slot,
      piece: hint,
      matchTier: 'perfect',
      contributionScore: pieceLoadoutContribution(hint, priorities),
    };
  }

  const candidates = patternSlotCandidates(items, slot, ctx);
  if (candidates.length > 0) {
    const best = candidates.reduce((best, item) =>
      comparePatternSlotCandidates(best, item, pattern, priorities, setTargets) > 0
        ? item
        : best,
    );

    return {
      slot,
      piece: best,
      matchTier: 'perfect',
      contributionScore: pieceLoadoutContribution(best, priorities),
    };
  }

  const nearCandidates = nearPatternSlotCandidates(items, slot, ctx);
  if (nearCandidates.length === 0) {
    return { slot, piece: null, matchTier: null, contributionScore: 0 };
  }

  const bestNear = nearCandidates.reduce((best, item) =>
    compareLoadoutPieces(best, item, priorities, setTargets) > 0 ? item : best,
  );

  return {
    slot,
    piece: bestNear,
    matchTier: 'near',
    contributionScore: pieceLoadoutContribution(bestNear, priorities),
  };
}

/** Best eligible piece per armor slot for one concrete roll pattern. */
export function bestPiecesForPatternBySlot(
  items: ArmorPiece[],
  pattern: OptimalRollPattern,
  priorities: Stat[],
  setTargets: SetBonusTarget[] = [],
  slotAssignment?: ReadonlyMap<ArmorSlot, ArmorPiece>,
  setHash?: number,
  setName?: string,
): PatternSlotLoadoutEntry[] {
  const ctx = columnSlotContextFromColumn(pattern, priorities, setHash, setName, setTargets);
  return ARMOR_SLOTS.map((slot) => bestPieceForPatternInSlot(items, slot, ctx, slotAssignment));
}

/** @deprecated Use bestPiecesForPatternBySlot */
export function bestPiecesForTuningStatBySlot(
  items: ArmorPiece[],
  tuningStat: Stat,
  priorities: Stat[],
): PatternSlotLoadoutEntry[] {
  const patterns = deriveOptimalRollPatterns(priorities).filter(
    (p) => p.tuningStat === tuningStat,
  );
  for (const pattern of patterns) {
    const bySlot = bestPiecesForPatternBySlot(items, pattern, priorities);
    if (bySlot.some((entry) => entry.piece !== null)) {
      return bySlot;
    }
  }
  const pattern = patterns[0];
  if (!pattern) {
    return ARMOR_SLOTS.map((slot) => ({ slot, piece: null, matchTier: null, contributionScore: 0 }));
  }
  return bestPiecesForPatternBySlot(items, pattern, priorities);
}

function bestPieceForPattern(
  items: ArmorPiece[],
  pattern: OptimalRollPattern,
  priorities: Stat[],
  setTargets: SetBonusTarget[] = [],
  slotAssignment?: ReadonlyMap<ArmorSlot, ArmorPiece>,
  setHash?: number,
  setName?: string,
): PatternLoadoutEntry {
  const patternKey = optimalRollPatternKey(pattern);
  const columnKey =
    setHash !== undefined ? patternSetColumnKey(patternKey, setHash) : patternKey;
  const bySlot = bestPiecesForPatternBySlot(
    items,
    pattern,
    priorities,
    setTargets,
    slotAssignment,
    setHash,
  );
  const filled = bySlot.filter((entry) => entry.matchTier === 'perfect');
  if (filled.length === 0) {
    return {
      pattern,
      patternKey,
      columnKey,
      ...(setHash !== undefined ? { setHash, setName } : {}),
      piece: null,
      contributionScore: 0,
    };
  }

  const bestEntry = filled.reduce((best, entry) =>
    compareLoadoutPieces(best.piece!, entry.piece!, priorities, setTargets) > 0 ? entry : best,
  );

  return {
    pattern,
    patternKey,
    columnKey,
    ...(setHash !== undefined ? { setHash, setName } : {}),
    piece: bestEntry.piece,
    contributionScore: bestEntry.contributionScore,
  };
}

export type PatternLoadoutSource = 'representative' | 'auto';

/** @deprecated Use PatternLoadoutSource */
export type TuningLoadoutSource = PatternLoadoutSource;

export interface ResolvedPatternLoadout {
  piece: ArmorPiece | null;
  source: PatternLoadoutSource;
}

/** @deprecated Use ResolvedPatternLoadout */
export type ResolvedTuningLoadout = ResolvedPatternLoadout;

/** Whether a saved instance id still matches this roll pattern column. */
export function isValidPatternRepresentative(
  items: ArmorPiece[],
  pattern: OptimalRollPattern,
  instanceId: string,
  priorities: Stat[],
): boolean {
  const item = items.find((i) => i.instanceId === instanceId);
  if (!item) return false;
  return pieceEligibleForPatternColumn(item, pattern, priorities);
}

/** @deprecated Use isValidPatternRepresentative */
export function isValidTuningRepresentative(
  items: ArmorPiece[],
  tuningStat: Stat,
  instanceId: string,
  priorities: Stat[],
): boolean {
  const item = items.find((i) => i.instanceId === instanceId);
  if (!item) return false;
  return pieceEligibleForTuningColumn(item, tuningStat, priorities);
}

/** All vault pieces matching this roll pattern in one slot, best fit first. */
export function rankEligiblePiecesForColumnSlot(
  items: ArmorPiece[],
  slot: ArmorSlot,
  ctx: ColumnSlotContext,
): EligibleLoadoutPiece[] {
  if (ctx.setHash === undefined) {
    return rankEligiblePiecesForPattern(items, ctx.pattern, ctx.priorities, ctx.setTargets).filter(
      ({ piece }) => piece.armorSlot === slot,
    );
  }

  return patternSlotCandidates(items, slot, ctx)
    .map((piece) => ({
      piece,
      contributionScore: pieceLoadoutContribution(piece, ctx.priorities),
      fitLabel: formatPieceLoadoutFitLabel(piece, ctx.priorities),
    }))
    .sort((a, b) =>
      comparePatternSlotCandidates(
        a.piece,
        b.piece,
        ctx.pattern,
        ctx.priorities,
        ctx.setTargets,
      ),
    );
}

/** All vault pieces matching this roll pattern in one slot, best fit first. */
export function rankEligiblePiecesForPatternInSlot(
  items: ArmorPiece[],
  slot: ArmorSlot,
  pattern: OptimalRollPattern,
  priorities: Stat[],
  setTargets: SetBonusTarget[] = [],
  setHash?: number,
): EligibleLoadoutPiece[] {
  return rankEligiblePiecesForColumnSlot(
    items,
    slot,
    columnSlotContextFromColumn(pattern, priorities, setHash, undefined, setTargets),
  );
}

/** Whether a saved instance id still matches this roll pattern in the given slot. */
export function isValidPatternSlotRepresentative(
  items: ArmorPiece[],
  slot: ArmorSlot,
  pattern: OptimalRollPattern,
  instanceId: string,
  priorities: Stat[],
  setHash?: number,
): boolean {
  const item = items.find((i) => i.instanceId === instanceId);
  if (!item) return false;
  return (
    item.armorSlot === slot &&
    pieceEligibleForSetPatternColumnSlot(item, pattern, priorities, setHash)
  );
}

/** Use a saved slot representative when valid; otherwise fall back to the algorithm pick. */
export function resolvePatternSlotLoadoutPiece(
  items: ArmorPiece[],
  slot: ArmorSlot,
  pattern: OptimalRollPattern,
  priorities: Stat[],
  autoPiece: ArmorPiece | null,
  representativeId?: string,
  setHash?: number,
): ResolvedPatternLoadout {
  if (
    representativeId &&
    isValidPatternSlotRepresentative(
      items,
      slot,
      pattern,
      representativeId,
      priorities,
      setHash,
    )
  ) {
    const piece = items.find((i) => i.instanceId === representativeId)!;
    return { piece, source: 'representative' };
  }
  return { piece: autoPiece, source: 'auto' };
}

/** Derive per-slot reps from legacy column-level pattern picks. */
export function migrateRollPatternToSlotRepresentatives(
  items: ArmorPiece[],
  priorities: Stat[],
  rollPatternRepresentatives?: Partial<Record<string, string>>,
): Partial<Record<string, Partial<Record<ArmorSlot, string>>>> | undefined {
  if (!rollPatternRepresentatives) return undefined;

  const patterns = deriveOptimalRollPatterns(priorities);
  const out: Partial<Record<string, Partial<Record<ArmorSlot, string>>>> = {};

  for (const [patternKey, instanceId] of Object.entries(rollPatternRepresentatives)) {
    const item = items.find((i) => i.instanceId === instanceId);
    if (!item) continue;
    const pattern = patterns.find((p) => optimalRollPatternKey(p) === patternKey);
    if (!pattern || !pieceEligibleForPatternColumn(item, pattern, priorities)) continue;
    if (!out[patternKey]) out[patternKey] = {};
    out[patternKey]![item.armorSlot] = instanceId;
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

/** Expand legacy pattern-only keys to per-set column keys when combo has set targets. */
export function expandRollPatternSlotRepresentativesForSetTargets(
  reps: Partial<Record<string, Partial<Record<ArmorSlot, string>>>>,
  priorities: Stat[],
  setTargets: SetBonusTarget[],
): Partial<Record<string, Partial<Record<ArmorSlot, string>>>> {
  if (setTargets.length === 0) return reps;

  const patternKeys = new Set(
    deriveOptimalRollPatterns(priorities).map((pattern) => optimalRollPatternKey(pattern)),
  );
  const out: Partial<Record<string, Partial<Record<ArmorSlot, string>>>> = { ...reps };

  for (const [key, slots] of Object.entries(reps)) {
    if (!patternKeys.has(key)) continue;
    for (const target of setTargets) {
      const columnKey = patternSetColumnKey(key, target.hash);
      if (!out[columnKey]) {
        out[columnKey] = { ...slots };
      }
    }
    delete out[key];
  }

  return out;
}

/** Effective per-slot pattern reps: saved picks, else migrated from column or legacy picks. */
export function resolveEffectiveRollPatternSlotRepresentatives(
  items: ArmorPiece[],
  priorities: Stat[],
  rollPatternSlotRepresentatives?: Partial<
    Record<string, Partial<Record<ArmorSlot, string>>>
  >,
  rollPatternRepresentatives?: Partial<Record<string, string>>,
  tuningRepresentatives?: Partial<Record<Stat, string>>,
  slotRepresentatives?: Partial<Record<ArmorSlot, string>>,
  setTargets: SetBonusTarget[] = [],
): Partial<Record<string, Partial<Record<ArmorSlot, string>>>> {
  const saved = rollPatternSlotRepresentatives ?? {};
  const hasSaved = Object.keys(saved).length > 0;
  if (hasSaved) {
    return expandRollPatternSlotRepresentativesForSetTargets(saved, priorities, setTargets);
  }

  const fromColumn = migrateRollPatternToSlotRepresentatives(
    items,
    priorities,
    rollPatternRepresentatives,
  );
  if (fromColumn && Object.keys(fromColumn).length > 0) {
    return expandRollPatternSlotRepresentativesForSetTargets(fromColumn, priorities, setTargets);
  }

  const fromLegacy = resolveEffectiveRollPatternRepresentatives(
    items,
    priorities,
    undefined,
    tuningRepresentatives,
    slotRepresentatives,
  );
  const migrated =
    migrateRollPatternToSlotRepresentatives(items, priorities, fromLegacy) ?? {};
  return expandRollPatternSlotRepresentativesForSetTargets(migrated, priorities, setTargets);
}

/** Use a saved representative when valid; otherwise fall back to the algorithm pick. */
export function resolvePatternLoadoutPiece(
  items: ArmorPiece[],
  pattern: OptimalRollPattern,
  priorities: Stat[],
  autoPiece: ArmorPiece | null,
  representativeId?: string,
): ResolvedPatternLoadout {
  if (
    representativeId &&
    isValidPatternRepresentative(items, pattern, representativeId, priorities)
  ) {
    const piece = items.find((i) => i.instanceId === representativeId)!;
    return { piece, source: 'representative' };
  }
  return { piece: autoPiece, source: 'auto' };
}

/** @deprecated Use resolvePatternLoadoutPiece */
export function resolveTuningLoadoutPiece(
  items: ArmorPiece[],
  tuningStat: Stat,
  priorities: Stat[],
  autoPiece: ArmorPiece | null,
  representativeId?: string,
): ResolvedPatternLoadout {
  const patterns = deriveOptimalRollPatterns(priorities);
  const pattern =
    (autoPiece &&
      patterns.find((candidate) => pieceMatchesRollPattern(autoPiece, candidate))) ??
    patterns.find((candidate) => candidate.tuningStat === tuningStat);
  if (!pattern) return { piece: autoPiece, source: 'auto' };
  return resolvePatternLoadoutPiece(
    items,
    pattern,
    priorities,
    autoPiece,
    representativeId,
  );
}

/** Map legacy tuning reps to roll-pattern keys using piece identity. */
export function migrateTuningToRollPatternRepresentatives(
  items: ArmorPiece[],
  priorities: Stat[],
  tuningRepresentatives?: Partial<Record<Stat, string>>,
): Partial<Record<string, string>> | undefined {
  if (!tuningRepresentatives) return undefined;

  const patterns = deriveOptimalRollPatterns(priorities);
  const out: Partial<Record<string, string>> = {};

  for (const [tuningStat, instanceId] of Object.entries(tuningRepresentatives)) {
    const item = items.find((i) => i.instanceId === instanceId);
    if (!item) continue;

    const match =
      patterns.find((pattern) => pieceEligibleForPatternColumn(item, pattern, priorities)) ??
      patterns.find((pattern) => pattern.tuningStat === tuningStat);

    if (match) out[optimalRollPatternKey(match)] = instanceId;
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

/** Derive roll-pattern reps from legacy slot picks — best piece per pattern. */
export function migrateSlotToRollPatternRepresentatives(
  items: ArmorPiece[],
  slotRepresentatives: Partial<Record<ArmorSlot, string>> | undefined,
  priorities: Stat[],
): Partial<Record<string, string>> | undefined {
  if (!slotRepresentatives) return undefined;

  const patterns = deriveOptimalRollPatterns(priorities);
  const out: Partial<Record<string, string>> = {};

  for (const pattern of patterns) {
    let best: ArmorPiece | null = null;
    for (const instanceId of Object.values(slotRepresentatives)) {
      const item = items.find((i) => i.instanceId === instanceId);
      if (!item || !pieceEligibleForPatternColumn(item, pattern, priorities)) continue;
      if (!best || compareLoadoutPieces(item, best, priorities) > 0) {
        best = item;
      }
    }
    if (best) out[optimalRollPatternKey(pattern)] = best.instanceId;
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

/** Effective roll-pattern reps: saved picks, else migrated from tuning or slot picks. */
export function resolveEffectiveRollPatternRepresentatives(
  items: ArmorPiece[],
  priorities: Stat[],
  rollPatternRepresentatives?: Partial<Record<string, string>>,
  tuningRepresentatives?: Partial<Record<Stat, string>>,
  slotRepresentatives?: Partial<Record<ArmorSlot, string>>,
): Partial<Record<string, string>> {
  const saved = rollPatternRepresentatives ?? {};
  if (Object.keys(saved).length > 0) return saved;

  const fromTuning = migrateTuningToRollPatternRepresentatives(
    items,
    priorities,
    tuningRepresentatives,
  );
  if (fromTuning && Object.keys(fromTuning).length > 0) return fromTuning;

  return migrateSlotToRollPatternRepresentatives(items, slotRepresentatives, priorities) ?? {};
}

/** @deprecated Use migrateSlotToRollPatternRepresentatives */
export function migrateSlotToTuningRepresentatives(
  items: ArmorPiece[],
  slotRepresentatives: Partial<Record<ArmorSlot, string>> | undefined,
  priorities: Stat[],
): Partial<Record<Stat, string>> | undefined {
  if (!slotRepresentatives) return undefined;

  const out: Partial<Record<Stat, string>> = {};
  for (const tuningStat of viableTuningStats(priorities)) {
    let best: ArmorPiece | null = null;
    for (const instanceId of Object.values(slotRepresentatives)) {
      const item = items.find((i) => i.instanceId === instanceId);
      if (!item || !pieceEligibleForTuningColumn(item, tuningStat, priorities)) continue;
      if (!best || compareLoadoutPieces(item, best, priorities) > 0) {
        best = item;
      }
    }
    if (best) out[tuningStat] = best.instanceId;
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

/** @deprecated Use resolveEffectiveRollPatternRepresentatives */
export function resolveEffectiveTuningRepresentatives(
  items: ArmorPiece[],
  priorities: Stat[],
  tuningRepresentatives?: Partial<Record<Stat, string>>,
  slotRepresentatives?: Partial<Record<ArmorSlot, string>>,
): Partial<Record<Stat, string>> {
  const saved = tuningRepresentatives ?? {};
  const hasSaved = viableTuningStats(priorities).some((stat) => saved[stat]);
  if (hasSaved) return saved;

  return migrateSlotToTuningRepresentatives(items, slotRepresentatives, priorities) ?? {};
}

/** Pick the best vault piece per concrete optimal roll pattern (× target set when configured). */
export function selectRecommendedPatternLoadout(
  items: ArmorPiece[],
  targets: StatTarget[],
  setBonuses?: Pick<BuildProfile, 'setBonus2pc' | 'setBonus4pc'>,
): RecommendedPatternLoadout {
  const priorities = priorityStatsFromTargets(targets);
  const setTargets = parseSetBonusTargets(setBonuses?.setBonus2pc, setBonuses?.setBonus4pc);
  const slotAssignment =
    setTargets.length === 0
      ? undefined
      : new Map(
          selectRecommendedLoadout(items, targets, setBonuses)
            .slots.filter((entry) => entry.piece !== null)
            .map((entry) => [entry.slot, entry.piece!] as const),
        );
  const patterns = deriveOptimalRollPatterns(priorities);

  const columns: PatternLoadoutEntry[] =
    setTargets.length === 0
      ? patterns.map((pattern) =>
          bestPieceForPattern(items, pattern, priorities, setTargets, slotAssignment),
        )
      : patterns.flatMap((pattern) =>
          setTargets.map((target) =>
            bestPieceForPattern(
              items,
              pattern,
              priorities,
              setTargets,
              undefined,
              target.hash,
              resolveSetName(items, target.hash),
            ),
          ),
        );

  const columnsFilled = columns.filter((entry) => entry.piece !== null).length;

  return {
    columns,
    columnsFilled,
    columnsTotal: setTargets.length === 0 ? patterns.length : patterns.length * setTargets.length,
  };
}

/** @deprecated Use selectRecommendedPatternLoadout */
export function selectRecommendedTuningLoadout(
  items: ArmorPiece[],
  targets: StatTarget[],
): RecommendedPatternLoadout {
  return selectRecommendedPatternLoadout(items, targets);
}

export function patternLoadoutVerdictFromLoadout(
  loadout: RecommendedPatternLoadout,
): LoadoutVerdict {
  const { columnsFilled, columnsTotal } = loadout;

  let verdict: BuildVerdict;
  if (columnsFilled === 0) {
    verdict = 'need_rolls';
  } else if (columnsFilled === columnsTotal) {
    verdict = 'ready';
  } else {
    verdict = 'almost';
  }

  const summary = formatPatternLoadoutVerdictSummary(columnsFilled, columnsTotal);
  return { verdict, slotsFilled: columnsFilled, slotsTotal: columnsTotal, summary };
}

/** @deprecated Use patternLoadoutVerdictFromLoadout */
export function tuningLoadoutVerdictFromLoadout(
  loadout: RecommendedPatternLoadout,
): LoadoutVerdict {
  return patternLoadoutVerdictFromLoadout(loadout);
}

/** Short tuning coverage for banners and build tabs (Ready vs 1 of 2). */
export function formatTuningLoadoutStatus({
  verdict,
  slotsFilled,
  slotsTotal,
}: LoadoutVerdict): string {
  if (slotsFilled === slotsTotal && slotsTotal > 0) {
    return formatBuildVerdict(verdict);
  }
  if (slotsFilled === 0) {
    return formatBuildVerdict(verdict);
  }
  return `${slotsFilled} of ${slotsTotal}`;
}

export function formatPatternLoadoutVerdictSummary(
  columnsFilled: number,
  columnsTotal: number,
): string {
  if (columnsFilled === 0) {
    return 'No vault pieces roll these optimal patterns yet.';
  }
  if (columnsFilled === columnsTotal) {
    return `Complete pattern coverage — one piece per roll (${columnsTotal}/${columnsTotal}).`;
  }
  const empty = columnsTotal - columnsFilled;
  return `${columnsFilled}/${columnsTotal} roll patterns covered · ${empty} pattern${empty === 1 ? '' : 's'} still need a fit.`;
}

/** @deprecated Use formatPatternLoadoutVerdictSummary */
export function formatTuningLoadoutVerdictSummary(
  columnsFilled: number,
  columnsTotal: number,
): string {
  return formatPatternLoadoutVerdictSummary(columnsFilled, columnsTotal);
}

export function analyzeRecommendedPatternLoadout(
  items: ArmorPiece[],
  targets: StatTarget[],
  setBonuses?: Pick<BuildProfile, 'setBonus2pc' | 'setBonus4pc'>,
): {
  patternLoadout: RecommendedPatternLoadout;
  patternLoadoutVerdict: LoadoutVerdict;
} {
  const patternLoadout = selectRecommendedPatternLoadout(items, targets, setBonuses);
  const patternLoadoutVerdict = patternLoadoutVerdictFromLoadout(patternLoadout);
  return { patternLoadout, patternLoadoutVerdict };
}

/** @deprecated Use analyzeRecommendedPatternLoadout */
export function analyzeRecommendedTuningLoadout(
  items: ArmorPiece[],
  targets: StatTarget[],
): {
  tuningLoadout: RecommendedPatternLoadout;
  tuningLoadoutVerdict: LoadoutVerdict;
} {
  const { patternLoadout, patternLoadoutVerdict } = analyzeRecommendedPatternLoadout(
    items,
    targets,
  );
  return {
    tuningLoadout: patternLoadout,
    tuningLoadoutVerdict: patternLoadoutVerdict,
  };
}
