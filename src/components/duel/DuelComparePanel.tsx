import type { ArmorPiece, ClassPreferenceProfile, DupeRuleConfig, ScoreBreakdown, Stat } from '@/types';
import { ItemIcon } from '@/components/items/ItemIcon';
import { StatIcon } from '@/components/StatIcon';
import { DuelSetBlock } from '@/components/duel/DuelSetBlock';
import { OnlyRollBadge } from '@/components/duel/OnlyRollBadge';
import { cardStatsForPiece } from '@/components/duel/ArmorCard';
import { formatArmorTierBadge, hasDisplayTier } from '@/lib/armor/tier';
import { isSingletonRoll, onlyRollTooltip } from '@/lib/armor/uniqueRoll';
import { ARCHETYPE_LABELS, STAT_LABELS } from '@/lib/constants';
import { intrinsicStats } from '@/lib/armor/intrinsicCompare';
import { armorDiffLines } from '@/lib/armor/diff';
import { resolveArmorSetInfo } from '@/lib/scoring/calibrate';
import {
  formatMatchGap,
  formatMatchScore,
  matchGapPercent,
} from '@/lib/scoring/fitDisplay';
import {
  preferredSetWeight,
  preferredTuningWeight,
} from '@/lib/scoring/redundantKeepPriority';
import type { ArmorDiffLine } from '@/lib/armor/diff';
import type { CardStatEntry } from '@/components/duel/ArmorCard';
import { BUCKET_ELIMINATION_LOSS_THRESHOLD } from '@/lib/constants';
import { DUEL_KEY_LABELS } from '@/lib/duel/keyboard';
import {
  tagJunkBothDuelBtnClass,
  tagJunkDuelBtnClass,
  tagKeepBothDuelBtnClass,
  tagKeepDuelBtnClass,
} from '@/lib/dim/tagConfig';
import { DuelKeyboardLegend } from '@/components/duel/DuelKeyboardLegend';
import { lossesUntilElimination } from '@/lib/dupes/duel';
import {
  DUEL_IDENTICAL_ROLLS_BANNER,
  DUEL_SUPPRESSED_SUGGESTION_BANNER,
  formatDuelSuggestionBuildOptimalReason,
} from '@/lib/duel/suggestion';

export interface DuelComparePanelProps {
  left: ArmorPiece;
  right: ArmorPiece;
  recommended: 'a' | 'b' | 'tie';
  suggestionSuppressed?: boolean;
  identicalRolls?: boolean;
  breakdownLeft: ScoreBreakdown;
  breakdownRight: ScoreBreakdown;
  classPrefs: ClassPreferenceProfile;
  allItems: ArmorPiece[];
  dupeRules: DupeRuleConfig;
  /** Junked / eliminated this bucket — omitted from vault peer counts. */
  excludeInstanceIds?: string[];
  /** Prefer losses recorded this bucket (double elimination). */
  lossCountLeft?: number;
  lossCountRight?: number;
  onPickLeft: () => void;
  onPickRight: () => void;
  onKeepLeft: () => void;
  onKeepRight: () => void;
  onKeepBoth: () => void;
  onJunkLeft: () => void;
  onJunkRight: () => void;
  onJunkBoth: () => void;
  onPassPair: () => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
  disabled?: boolean;
}

function isPreferredSet(
  piece: ArmorPiece,
  opponent: ArmorPiece,
  prefs: ClassPreferenceProfile,
): boolean {
  return preferredSetWeight(piece, prefs) > preferredSetWeight(opponent, prefs);
}

function isPreferredTuning(
  piece: ArmorPiece,
  opponent: ArmorPiece,
  prefs: ClassPreferenceProfile,
): boolean {
  return preferredTuningWeight(piece, prefs) > preferredTuningWeight(opponent, prefs);
}

function duelSimilaritiesHeader(
  left: ArmorPiece,
  right: ArmorPiece,
  recommended: 'a' | 'b' | 'tie',
): string {
  if (left.archetype === right.archetype && left.tertiaryStat === right.tertiaryStat) {
    return `${ARCHETYPE_LABELS[left.archetype]} · ${STAT_LABELS[left.tertiaryStat]}`;
  }
  const ref = recommended === 'b' ? right : left;
  return `${ARCHETYPE_LABELS[ref.archetype]} · ${STAT_LABELS[ref.tertiaryStat]}`;
}

function matchingStatEntries(left: ArmorPiece, right: ArmorPiece): CardStatEntry[] {
  const rollL = intrinsicStats(left);
  const rollR = intrinsicStats(right);
  return cardStatsForPiece(left).filter((entry) => rollL[entry.stat] === rollR[entry.stat]);
}

const actionBtnBase =
  'py-2.5 sm:py-3 text-xs sm:text-sm rounded-md transition-colors font-medium min-w-0 min-h-[2.75rem]';

const preferBtnClass = `${actionBtnBase} ui-btn-secondary`;

const passBtnClass = `${actionBtnBase} text-muted hover:text-white border border-border hover:border-white/20`;

const keepSideBtnClass = tagKeepDuelBtnClass(actionBtnBase);
const keepBothBtnClass = tagKeepBothDuelBtnClass(actionBtnBase);
const junkSideBtnClass = tagJunkDuelBtnClass(actionBtnBase);
const junkBothBtnClass = tagJunkBothDuelBtnClass(actionBtnBase);

const PREFER_OUTCOME = `Prefer this side. The loser needs ${BUCKET_ELIMINATION_LOSS_THRESHOLD} prefer losses before junk at bucket end.`;
const KEEP_SIDE_OUTCOME = 'Keep this when bucket finishes · other stays in bracket';
const KEEP_BOTH_OUTCOME = 'Both kept when bucket finishes';
const JUNK_ONE_OUTCOME = 'Junk this now · other stays in bracket (no winner)';
const JUNK_BOTH_OUTCOME = 'Both junked now';
const PASS_OUTCOME = 'Skip this pair. Neither is tagged; both are re-queued.';

/** Prevent click focus from scrolling the page stage to the action bar. */
function preventActionFocusScroll(e: React.MouseEvent) {
  e.preventDefault();
}

function DuelActionGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="duel-action-group">
      <p className="m-0 mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted/75">
        {label}
      </p>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">{children}</div>
    </div>
  );
}

function DuelActionBar({
  onPickLeft,
  onKeepLeft,
  onKeepBoth,
  onKeepRight,
  onPickRight,
  onJunkLeft,
  onJunkRight,
  onJunkBoth,
  onPassPair,
}: {
  onPickLeft: () => void;
  onKeepLeft: () => void;
  onKeepBoth: () => void;
  onKeepRight: () => void;
  onPickRight: () => void;
  onJunkLeft: () => void;
  onJunkRight: () => void;
  onJunkBoth: () => void;
  onPassPair: () => void;
}) {
  return (
    <div className="duel-compare__actions flex flex-col gap-2 sm:gap-2.5">
      <DuelActionGroup label="Keep">
        <button
          type="button"
          onMouseDown={preventActionFocusScroll}
          onClick={onKeepLeft}
          aria-label={`Keep left. ${KEEP_SIDE_OUTCOME}`}
          title={`${DUEL_KEY_LABELS.keepLeft} · ${KEEP_SIDE_OUTCOME}`}
          className={keepSideBtnClass}
        >
          Left
        </button>
        <button
          type="button"
          onMouseDown={preventActionFocusScroll}
          onClick={onKeepBoth}
          aria-label={`Keep both. ${KEEP_BOTH_OUTCOME}`}
          title={`${DUEL_KEY_LABELS.keepBoth} · ${KEEP_BOTH_OUTCOME}`}
          className={keepBothBtnClass}
        >
          Both
        </button>
        <button
          type="button"
          onMouseDown={preventActionFocusScroll}
          onClick={onKeepRight}
          aria-label={`Keep right. ${KEEP_SIDE_OUTCOME}`}
          title={`${DUEL_KEY_LABELS.keepRight} · ${KEEP_SIDE_OUTCOME}`}
          className={keepSideBtnClass}
        >
          Right
        </button>
      </DuelActionGroup>

      <DuelActionGroup label="Prefer">
        <button
          type="button"
          onMouseDown={preventActionFocusScroll}
          onClick={onPickLeft}
          aria-label={`Prefer left. ${PREFER_OUTCOME}`}
          title={`${DUEL_KEY_LABELS.preferLeft} · ${PREFER_OUTCOME}`}
          className={preferBtnClass}
        >
          Left
        </button>
        <button
          type="button"
          onMouseDown={preventActionFocusScroll}
          onClick={onPassPair}
          aria-label={`Pass pair. ${PASS_OUTCOME}`}
          title={`${DUEL_KEY_LABELS.pass} · ${PASS_OUTCOME}`}
          className={passBtnClass}
        >
          Pass
        </button>
        <button
          type="button"
          onMouseDown={preventActionFocusScroll}
          onClick={onPickRight}
          aria-label={`Prefer right. ${PREFER_OUTCOME}`}
          title={`${DUEL_KEY_LABELS.preferRight} · ${PREFER_OUTCOME}`}
          className={preferBtnClass}
        >
          Right
        </button>
      </DuelActionGroup>

      <DuelActionGroup label="Junk">
        <button
          type="button"
          onMouseDown={preventActionFocusScroll}
          onClick={onJunkLeft}
          aria-label={`Junk left. ${JUNK_ONE_OUTCOME}`}
          title={`${DUEL_KEY_LABELS.junkLeft} · ${JUNK_ONE_OUTCOME}`}
          className={junkSideBtnClass}
        >
          Left
        </button>
        <button
          type="button"
          onMouseDown={preventActionFocusScroll}
          onClick={onJunkBoth}
          aria-label={`Junk both. ${JUNK_BOTH_OUTCOME}`}
          title={`${DUEL_KEY_LABELS.junkBoth} · ${JUNK_BOTH_OUTCOME}`}
          className={junkBothBtnClass}
        >
          Both
        </button>
        <button
          type="button"
          onMouseDown={preventActionFocusScroll}
          onClick={onJunkRight}
          aria-label={`Junk right. ${JUNK_ONE_OUTCOME}`}
          title={`${DUEL_KEY_LABELS.junkRight} · ${JUNK_ONE_OUTCOME}`}
          className={junkSideBtnClass}
        >
          Right
        </button>
      </DuelActionGroup>

      <div className="hidden sm:flex sm:justify-center pt-0.5 w-full">
        <DuelKeyboardLegend compact />
      </div>
      <p className="m-0 hidden text-center text-[0.625rem] leading-snug text-muted/80 sm:block">
        Hover buttons for outcomes · ↑ keep both · Space pass · ↓ junk both · Ctrl+←/→ junk sides
      </p>
    </div>
  );
}

function DuelTuningBadge({
  stat,
  preferred,
  differs,
}: {
  stat: Stat;
  preferred?: boolean;
  differs?: boolean;
}) {
  const label = STAT_LABELS[stat];
  const muted = Boolean(differs && !preferred);

  return (
    <div
      className={`mt-2 w-full rounded border px-2 py-1.5 ${
        preferred
          ? 'border-white/30 bg-white/[0.06]'
          : muted
            ? 'border-border/40 bg-surface/30'
            : 'border-border/60 bg-surface-3/40'
      }`}
      title={`Tuning: ${label}`}
    >
      <div
        className={`inline-flex w-full flex-wrap items-center justify-center gap-1 text-[10px] font-semibold leading-snug ${
          preferred ? 'text-white' : muted ? 'text-muted' : 'text-white/85'
        }`}
      >
        <StatIcon stat={stat} size="sm" variant="glyph" />
        <span>Tuning: {label}</span>
        {preferred && differs && (
          <span className="text-[9px] font-medium uppercase tracking-wider text-white/70">
            Preferred
          </span>
        )}
      </div>
    </div>
  );
}

function SharedStatsPills({ entries }: { entries: CardStatEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="duel-shared-inline flex flex-wrap justify-center gap-1.5">
      {entries.map((entry) => (
        <span
          key={`${entry.role}-${entry.stat}`}
          className="inline-flex items-center gap-0.5 rounded-md bg-white/5 px-1.5 py-1 text-[11px] text-white/85"
          title={STAT_LABELS[entry.stat]}
        >
          <StatIcon stat={entry.stat} size="sm" variant="glyph" />
          <span className="tabular-nums font-medium">{entry.value}</span>
        </span>
      ))}
    </div>
  );
}

function SameTuningLine({ stat }: { stat: Stat }) {
  return (
    <p className="text-[10px] text-center text-white/75 font-medium">
      <span className="inline-flex items-center justify-center gap-1">
        <StatIcon stat={stat} size="sm" variant="glyph" />
        Tuning: {STAT_LABELS[stat]}
      </span>
    </p>
  );
}

function PickCardStatDiffs({
  lines,
  side,
}: {
  lines: ArmorDiffLine[];
  side: 'left' | 'right';
}) {
  const statLines = lines.filter((l) => l.kind === 'stat');
  if (statLines.length === 0) return null;

  return (
    <div className="mt-2 flex w-full flex-col gap-1">
      {statLines.map((line) => {
        const delta = line.delta ?? 0;
        const value = side === 'left' ? line.value : line.other;
        const wins = side === 'left' ? delta > 0 : delta < 0;
        const loses = side === 'left' ? delta < 0 : delta > 0;
        const displayDelta = side === 'left' ? delta : -delta;
        return (
          <div
            key={line.stat ?? line.label}
            className={`rounded border px-2 py-1 text-[10px] font-medium tabular-nums ${
              wins
                ? 'border-white/30 bg-white/[0.06] text-white'
                : loses
                  ? 'border-border/40 bg-surface/30 text-muted'
                  : 'border-border/60 bg-surface-3/40 text-white/85'
            }`}
          >
            <span className="inline-flex w-full items-center justify-center gap-1">
              {line.stat && <StatIcon stat={line.stat} size="sm" variant="glyph" />}
              <span>{line.label}</span>
              <span>{value}</span>
              {wins && displayDelta !== 0 && (
                <span className="text-[9px] text-white/60">
                  ({displayDelta > 0 ? '+' : ''}
                  {displayDelta})
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function LossCountBadge({ lossCount }: { lossCount: number }) {
  if (lossCount <= 0) return null;
  const label = lossCount === 1 ? '1 loss' : `${lossCount} losses`;
  const remaining = lossesUntilElimination(lossCount);
  return (
    <span
      className="text-[9px] uppercase tracking-wider text-amber-300/90"
      title={
        remaining > 0
          ? `${remaining} more prefer loss${remaining === 1 ? '' : 'es'} before junk at bucket end`
          : 'Eliminated from bracket'
      }
    >
      {label}
    </span>
  );
}

function DuelPickCard({
  piece,
  matchLabel,
  recommended,
  tuningPreferred,
  tuningDiffers,
  statLines,
  side,
  onlyRoll,
  sameRoll,
  lossCount = 0,
  onSelect,
}: {
  piece: ArmorPiece;
  matchLabel: string;
  recommended: boolean;
  tuningPreferred?: boolean;
  tuningDiffers?: boolean;
  statLines?: ArmorDiffLine[];
  side: 'left' | 'right';
  onlyRoll?: boolean;
  sameRoll?: boolean;
  lossCount?: number;
  onSelect: () => void;
}) {
  const tierLabel = hasDisplayTier(piece.tier) ? formatArmorTierBadge(piece.tier) : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="duel-pick-card ui-card flex flex-col items-center text-center w-full h-full min-h-[5.5rem] py-3 px-4 transition-all"
      aria-label={
        side === 'left'
          ? `Prefer left. ${PREFER_OUTCOME}`
          : `Prefer right. ${PREFER_OUTCOME}`
      }
      title={PREFER_OUTCOME}
    >
      <div className="mx-auto">
        <ItemIcon piece={piece} size="lg" />
      </div>
      <p className="mt-1 font-semibold text-white text-sm leading-tight line-clamp-1 w-full">
        {piece.name}
      </p>
      <div className="mt-0.5 flex flex-wrap items-center justify-center gap-1.5 text-xs">
        {tierLabel && (
          <span className="text-[10px] uppercase tracking-wider text-muted tabular-nums">
            {tierLabel}
          </span>
        )}
        <span className="text-[11px] font-semibold text-white/75">{matchLabel}</span>
        {recommended && (
          <span className="text-[9px] uppercase tracking-wider text-green-400">Suggested</span>
        )}
        {sameRoll && (
          <span className="text-[9px] uppercase tracking-wider text-muted">Same roll</span>
        )}
        {onlyRoll && <OnlyRollBadge compact tooltip={onlyRollTooltip(piece)} />}
        <LossCountBadge lossCount={lossCount} />
      </div>
      {tuningDiffers && piece.tuningStat && (
        <DuelTuningBadge
          stat={piece.tuningStat}
          preferred={tuningPreferred}
          differs
        />
      )}
      {statLines && statLines.length > 0 && (
        <PickCardStatDiffs lines={statLines} side={side} />
      )}
    </button>
  );
}

function DuelDiffStrip({
  left,
  right,
  recommended,
}: {
  left: ArmorPiece;
  right: ArmorPiece;
  recommended: 'a' | 'b' | 'tie';
}) {
  const setsDiffer = (left.armorSet?.hash ?? null) !== (right.armorSet?.hash ?? null);
  const sameTuning = left.tuningStat === right.tuningStat;
  const sharedStats = matchingStatEntries(left, right);
  const header = duelSimilaritiesHeader(left, right, recommended);

  const footnotes: string[] = [];
  if (!setsDiffer) {
    footnotes.push(`Set: ${left.armorSet?.name ?? 'No set'}`);
  }

  const hasCenterContent =
    sharedStats.length > 0 || (sameTuning && Boolean(left.tuningStat));

  return (
    <div className="duel-diff-strip flex flex-col gap-2 min-w-0 md:min-w-[10rem] md:max-w-[15rem]">
      <p className="text-center text-xs font-semibold text-white leading-snug px-1">{header}</p>

      {sharedStats.length > 0 && <SharedStatsPills entries={sharedStats} />}

      {sameTuning && left.tuningStat && (
        <SameTuningLine stat={left.tuningStat} />
      )}

      {footnotes.length > 0 && (
        <p className="text-[10px] text-center text-muted/65 leading-snug px-2">
          {footnotes.join(' · ')}
        </p>
      )}

      {!hasCenterContent && footnotes.length === 0 && (
        <p className="text-[11px] text-center text-muted px-2">Compare sides</p>
      )}
    </div>
  );
}

function DuelSetHero({
  left,
  right,
  classPrefs,
  allItems,
}: {
  left: ArmorPiece;
  right: ArmorPiece;
  classPrefs: ClassPreferenceProfile;
  allItems: ArmorPiece[];
}) {
  const leftInfo = resolveArmorSetInfo(allItems, left);
  const rightInfo = resolveArmorSetInfo(allItems, right);
  const leftName = leftInfo?.name ?? left.armorSet?.name ?? 'No set';
  const rightName = rightInfo?.name ?? right.armorSet?.name ?? 'No set';
  const leftPreferred = isPreferredSet(left, right, classPrefs);
  const rightPreferred = isPreferredSet(right, left, classPrefs);

  return (
    <div className="duel-set-hero grid sm:grid-cols-2 gap-3">
      <DuelSetBlock
        setInfo={leftInfo}
        setName={leftName}
        preferred={leftPreferred}
        differsFromOpponent
      />
      <DuelSetBlock
        setInfo={rightInfo}
        setName={rightName}
        preferred={rightPreferred}
        differsFromOpponent
      />
    </div>
  );
}

export function DuelComparePanel({
  left,
  right,
  recommended,
  suggestionSuppressed = false,
  identicalRolls = false,
  breakdownLeft,
  breakdownRight,
  classPrefs,
  allItems,
  dupeRules,
  excludeInstanceIds,
  lossCountLeft = 0,
  lossCountRight = 0,
  onPickLeft,
  onPickRight,
  onKeepLeft,
  onKeepRight,
  onKeepBoth,
  onJunkLeft,
  onJunkRight,
  onJunkBoth,
  onPassPair,
  onTouchStart,
  onTouchEnd,
  disabled = false,
}: DuelComparePanelProps) {
  const lines = armorDiffLines(left, right).filter(
    (l) => l.kind !== 'power' && l.kind !== 'masterwork',
  );
  const setsDiffer = (left.armorSet?.hash ?? null) !== (right.armorSet?.hash ?? null);
  const tuningDiffers = left.tuningStat !== right.tuningStat;

  const suggestLeft = !suggestionSuppressed && !identicalRolls && recommended === 'a';
  const suggestRight = !suggestionSuppressed && !identicalRolls && recommended === 'b';
  const leftTuningPreferred = isPreferredTuning(left, right, classPrefs);
  const rightTuningPreferred = isPreferredTuning(right, left, classPrefs);

  const statLines = lines.filter((l) => l.kind === 'stat');
  const gapPercent = matchGapPercent(breakdownLeft, breakdownRight);
  const peerCountOpts = excludeInstanceIds?.length
    ? { excludeInstanceIds }
    : undefined;
  const leftOnlyRoll = isSingletonRoll(left, allItems, dupeRules, peerCountOpts);
  const rightOnlyRoll = isSingletonRoll(right, allItems, dupeRules, peerCountOpts);
  const suggestedPiece = suggestLeft ? left : suggestRight ? right : null;
  const buildOptimalReason = suggestedPiece
    ? formatDuelSuggestionBuildOptimalReason(suggestedPiece, classPrefs)
    : undefined;

  const diffStripProps = {
    left,
    right,
    recommended,
  };

  return (
    <section
      className={`duel-compare duel-compare--enter${disabled ? ' duel-compare--disabled' : ''}`}
      onTouchStart={disabled ? undefined : onTouchStart}
      onTouchEnd={disabled ? undefined : onTouchEnd}
      aria-busy={disabled}
    >
      <p className="duel-compare__banner text-sm leading-snug truncate">
        {identicalRolls ? (
          <span className="text-muted">{DUEL_IDENTICAL_ROLLS_BANNER}</span>
        ) : suggestionSuppressed ? (
          <span className="text-muted">{DUEL_SUPPRESSED_SUGGESTION_BANNER}</span>
        ) : recommended !== 'tie' ? (
          <>
            <span className="text-muted">Suggested pick: </span>
            <span className="text-white font-medium">
              {suggestLeft ? left.name : right.name}
            </span>
            <span className="text-muted text-xs ml-1.5">({formatMatchGap(gapPercent)})</span>
            {buildOptimalReason ? (
              <span className="text-muted text-xs ml-1.5">· {buildOptimalReason}</span>
            ) : null}
            <span className="text-muted text-xs ml-1.5">· or pass / keep / junk</span>
          </>
        ) : (
          <span className="text-muted">
            Even match. Prefer, pass, keep, or junk one or both.
          </span>
        )}
      </p>

      <div className="duel-compare__body">
        <div className="duel-compare__arena grid grid-cols-2 md:grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
          <DuelPickCard
            piece={left}
            matchLabel={formatMatchScore(breakdownLeft)}
            recommended={suggestLeft}
            tuningPreferred={leftTuningPreferred}
            tuningDiffers={tuningDiffers}
            statLines={statLines}
            side="left"
            onlyRoll={leftOnlyRoll}
            sameRoll={identicalRolls}
            lossCount={lossCountLeft}
            onSelect={onPickLeft}
          />

          <div className="duel-compare__diff-desktop hidden md:flex md:col-start-2 md:row-start-1">
            <DuelDiffStrip {...diffStripProps} />
          </div>

          <DuelPickCard
            piece={right}
            matchLabel={formatMatchScore(breakdownRight)}
            recommended={suggestRight}
            tuningPreferred={rightTuningPreferred}
            tuningDiffers={tuningDiffers}
            statLines={statLines}
            side="right"
            onlyRoll={rightOnlyRoll}
            sameRoll={identicalRolls}
            lossCount={lossCountRight}
            onSelect={onPickRight}
          />
        </div>

        <div className="duel-compare__diff-mobile md:hidden">
          <DuelDiffStrip {...diffStripProps} />
        </div>

        {setsDiffer && (
          <DuelSetHero
            left={left}
            right={right}
            classPrefs={classPrefs}
            allItems={allItems}
          />
        )}
      </div>

      <DuelActionBar
        onPickLeft={onPickLeft}
        onKeepLeft={onKeepLeft}
        onKeepBoth={onKeepBoth}
        onKeepRight={onKeepRight}
        onPickRight={onPickRight}
        onJunkLeft={onJunkLeft}
        onJunkRight={onJunkRight}
        onJunkBoth={onJunkBoth}
        onPassPair={onPassPair}
      />
    </section>
  );
}
