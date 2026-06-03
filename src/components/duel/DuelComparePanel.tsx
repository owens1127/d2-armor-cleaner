import { useTranslation } from 'react-i18next';
import type { ArmorPiece, ClassPreferenceProfile, DupeRuleConfig, ScoreBreakdown, Stat } from '@/types';
import { ItemIcon } from '@/components/items/ItemIcon';
import { StatIcon } from '@/components/StatIcon';
import { DuelSetBlock } from '@/components/duel/DuelSetBlock';
import { OnlyRollBadge } from '@/components/duel/OnlyRollBadge';
import { cardStatsForPiece } from '@/components/duel/ArmorCard';
import { formatArmorTierBadge, hasDisplayTier } from '@/lib/armor/tier';
import { isSingletonRoll, onlyRollTooltip } from '@/lib/armor/uniqueRoll';
import {
  armorDiffNoSetCopy,
  armorDiffSetFootnoteCopy,
  formatArchetypeTertiaryLabel,
  rollTuningInlineLabel,
  statLabel,
} from '@/i18n/gameCopy';
import { duelKeyLabelCopy } from '@/i18n/duelCopy';
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
import {
  tagJunkBothDuelBtnClass,
  tagJunkDuelBtnClass,
  tagKeepBothDuelBtnClass,
  tagKeepDuelBtnClass,
} from '@/lib/dim/tagConfig';
import { DuelKeyboardLegend } from '@/components/duel/DuelKeyboardLegend';
import { lossesUntilElimination } from '@/lib/dupes/duel';
import {
  duelIdenticalRollsBannerCopy,
  duelSuppressedSuggestionBannerCopy,
  formatDuelSuggestionBuildOptimalReason,
} from '@/i18n/duelCopy';

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
  /** Junked / eliminated this bucket - omitted from vault peer counts. */
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
    return formatArchetypeTertiaryLabel(left.archetype, left.tertiaryStat);
  }
  const ref = recommended === 'b' ? right : left;
  return formatArchetypeTertiaryLabel(ref.archetype, ref.tertiaryStat);
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
      <div className="grid grid-cols-3 gap-1 sm:gap-2 min-w-0">{children}</div>
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
  const { t } = useTranslation('duel');
  const preferOutcome = t('compare.outcomes.prefer', {
    threshold: BUCKET_ELIMINATION_LOSS_THRESHOLD,
  });
  const keepSideOutcome = t('compare.outcomes.keepSide');
  const keepBothOutcome = t('compare.outcomes.keepBoth');
  const junkOneOutcome = t('compare.outcomes.junkOne');
  const junkBothOutcome = t('compare.outcomes.junkBoth');
  const passOutcome = t('compare.outcomes.pass');

  return (
    <div className="duel-compare__actions flex flex-col gap-2 sm:gap-2.5">
      <DuelActionGroup label={t('compare.actionKeep')}>
        <button
          type="button"
          onMouseDown={preventActionFocusScroll}
          onClick={onKeepLeft}
          aria-label={t('compare.aria.keepLeft', { outcome: keepSideOutcome })}
          title={`${duelKeyLabelCopy('keepLeft')} · ${keepSideOutcome}`}
          className={keepSideBtnClass}
        >
          {t('keyboard.left')}
        </button>
        <button
          type="button"
          onMouseDown={preventActionFocusScroll}
          onClick={onKeepBoth}
          aria-label={t('compare.aria.keepBoth', { outcome: keepBothOutcome })}
          title={`${duelKeyLabelCopy('keepBoth')} · ${keepBothOutcome}`}
          className={keepBothBtnClass}
        >
          {t('keyboard.both')}
        </button>
        <button
          type="button"
          onMouseDown={preventActionFocusScroll}
          onClick={onKeepRight}
          aria-label={t('compare.aria.keepRight', { outcome: keepSideOutcome })}
          title={`${duelKeyLabelCopy('keepRight')} · ${keepSideOutcome}`}
          className={keepSideBtnClass}
        >
          {t('keyboard.right')}
        </button>
      </DuelActionGroup>

      <DuelActionGroup label={t('keyboard.prefer')}>
        <button
          type="button"
          onMouseDown={preventActionFocusScroll}
          onClick={onPickLeft}
          aria-label={t('compare.aria.preferLeft', { outcome: preferOutcome })}
          title={`${duelKeyLabelCopy('preferLeft')} · ${preferOutcome}`}
          className={preferBtnClass}
        >
          {t('keyboard.left')}
        </button>
        <button
          type="button"
          onMouseDown={preventActionFocusScroll}
          onClick={onPassPair}
          aria-label={t('compare.aria.passPair', { outcome: passOutcome })}
          title={`${duelKeyLabelCopy('pass')} · ${passOutcome}`}
          className={passBtnClass}
        >
          {t('compare.pass')}
        </button>
        <button
          type="button"
          onMouseDown={preventActionFocusScroll}
          onClick={onPickRight}
          aria-label={t('compare.aria.preferRight', { outcome: preferOutcome })}
          title={`${duelKeyLabelCopy('preferRight')} · ${preferOutcome}`}
          className={preferBtnClass}
        >
          {t('keyboard.right')}
        </button>
      </DuelActionGroup>

      <DuelActionGroup label={t('keyboard.junk')}>
        <button
          type="button"
          onMouseDown={preventActionFocusScroll}
          onClick={onJunkLeft}
          aria-label={t('compare.aria.junkLeft', { outcome: junkOneOutcome })}
          title={`${duelKeyLabelCopy('junkLeft')} · ${junkOneOutcome}`}
          className={junkSideBtnClass}
        >
          {t('keyboard.left')}
        </button>
        <button
          type="button"
          onMouseDown={preventActionFocusScroll}
          onClick={onJunkBoth}
          aria-label={t('compare.aria.junkBoth', { outcome: junkBothOutcome })}
          title={`${duelKeyLabelCopy('junkBoth')} · ${junkBothOutcome}`}
          className={junkBothBtnClass}
        >
          {t('keyboard.both')}
        </button>
        <button
          type="button"
          onMouseDown={preventActionFocusScroll}
          onClick={onJunkRight}
          aria-label={t('compare.aria.junkRight', { outcome: junkOneOutcome })}
          title={`${duelKeyLabelCopy('junkRight')} · ${junkOneOutcome}`}
          className={junkSideBtnClass}
        >
          {t('keyboard.right')}
        </button>
      </DuelActionGroup>

      <div className="hidden sm:flex sm:justify-center pt-0.5 w-full">
        <DuelKeyboardLegend compact />
      </div>
      <p className="m-0 hidden text-center text-[0.625rem] leading-snug text-muted/80 sm:block">
        {t('compare.keyboardHints')}
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
  const { t } = useTranslation('duel');
  const label = statLabel(stat);
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
      title={rollTuningInlineLabel(stat)}
    >
      <div
        className={`inline-flex w-full flex-wrap items-center justify-center gap-1 text-[10px] font-semibold leading-snug ${
          preferred ? 'text-white' : muted ? 'text-muted' : 'text-white/85'
        }`}
      >
        <StatIcon stat={stat} size="sm" variant="glyph" />
        <span>{t('compare.tuningLabel', { stat: label })}</span>
        {preferred && differs && (
          <span className="text-[9px] font-medium uppercase tracking-wider text-white/70">
            {t('compare.preferred')}
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
          title={statLabel(entry.stat)}
        >
          <StatIcon stat={entry.stat} size="sm" variant="glyph" />
          <span className="tabular-nums font-medium">{entry.value}</span>
        </span>
      ))}
    </div>
  );
}

function SameTuningLine({ stat }: { stat: Stat }) {
  const { t } = useTranslation('duel');
  return (
    <p className="text-[10px] text-center text-white/75 font-medium">
      <span className="inline-flex items-center justify-center gap-1">
        <StatIcon stat={stat} size="sm" variant="glyph" />
        {t('compare.tuningLabel', { stat: statLabel(stat) })}
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
  const { t } = useTranslation('duel');
  if (lossCount <= 0) return null;
  const label = t('compare.loss', { count: lossCount });
  const remaining = lossesUntilElimination(lossCount);
  return (
    <span
      className="text-[9px] uppercase tracking-wider text-amber-300/90"
      title={
        remaining > 0
          ? t('compare.lossRemaining', { count: remaining })
          : t('compare.eliminated')
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
  const { t } = useTranslation('duel');
  const preferOutcome = t('compare.outcomes.prefer', {
    threshold: BUCKET_ELIMINATION_LOSS_THRESHOLD,
  });
  const tierLabel = hasDisplayTier(piece.tier) ? formatArmorTierBadge(piece.tier) : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="duel-pick-card ui-card flex flex-col items-center text-center w-full h-full min-h-[5.5rem] py-3 px-4 transition-all"
      aria-label={
        side === 'left'
          ? t('compare.aria.preferLeft', { outcome: preferOutcome })
          : t('compare.aria.preferRight', { outcome: preferOutcome })
      }
      title={preferOutcome}
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
          <span className="text-[9px] uppercase tracking-wider text-green-400">{t('compare.suggested')}</span>
        )}
        {sameRoll && (
          <span className="text-[9px] uppercase tracking-wider text-muted">{t('compare.sameRoll')}</span>
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
  const { t } = useTranslation('duel');
  const header = duelSimilaritiesHeader(left, right, recommended);

  const footnotes: string[] = [];
  if (!setsDiffer) {
    footnotes.push(
      armorDiffSetFootnoteCopy(left.armorSet?.name ?? armorDiffNoSetCopy()),
    );
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
        <p className="text-[11px] text-center text-muted px-2">{t('compare.compareSides')}</p>
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
  const leftName = leftInfo?.name ?? left.armorSet?.name ?? armorDiffNoSetCopy();
  const rightName = rightInfo?.name ?? right.armorSet?.name ?? armorDiffNoSetCopy();
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
  const { t } = useTranslation('duel');
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
          <span className="text-muted">{duelIdenticalRollsBannerCopy()}</span>
        ) : suggestionSuppressed ? (
          <span className="text-muted">{duelSuppressedSuggestionBannerCopy()}</span>
        ) : recommended !== 'tie' ? (
          <>
            <span className="text-muted">{t('compare.suggestedPick')}</span>
            <span className="text-white font-medium">
              {suggestLeft ? left.name : right.name}
            </span>
            <span className="text-muted text-xs ml-1.5">({formatMatchGap(gapPercent)})</span>
            {buildOptimalReason ? (
              <span className="text-muted text-xs ml-1.5">· {buildOptimalReason}</span>
            ) : null}
            <span className="text-muted text-xs ml-1.5">{t('compare.orPassKeepJunk')}</span>
          </>
        ) : (
          <span className="text-muted">{t('compare.evenMatch')}</span>
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
