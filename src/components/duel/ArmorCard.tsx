import { useTranslation } from 'react-i18next';
import { armorDiffNoSetCopy, statLabel } from '@/i18n/gameCopy';
import { ARCHETYPE_STATS, STATS } from '@/lib/constants';
import type { ArmorPiece, ClassPreferenceProfile, DupeRuleConfig, ScoreBreakdown, Stat } from '@/types';
import { WantLabelBadge } from '@/components/WantLabelBadge';
import { StatIcon } from '@/components/StatIcon';
import type { WantLabel } from '@/lib/scoring/learn';
import { formatMatchScore } from '@/lib/scoring/fitDisplay';
import {
  buildArmorSubtitle,
  formatArmorTierBadge,
  hasDisplayTier,
} from '@/lib/armor/tier';
import { armorDiffLines, sameRollBadgeCopy, sameRollHelperCopy } from '@/lib/armor/diff';
import { intrinsicStatDelta, intrinsicStats, intrinsicStatsEqual } from '@/lib/armor/intrinsicCompare';
import { isSingletonRoll, onlyRollTooltip } from '@/lib/armor/uniqueRoll';
import { resolveArmorSetInfo } from '@/lib/scoring/calibrate';
import { preferredSetWeight, compareRedundantKeepPriority } from '@/lib/scoring/redundantKeepPriority';
import {
  compareBuildOptimalKeepPriority,
  isFullyIdenticalDuel,
  shouldSuppressDuelSuggestion,
} from '@/lib/duel/suggestion';
import { scoreItem } from '@/lib/scoring/score';
import { ItemIcon } from '@/components/items/ItemIcon';
import { BrowseCardActionGrid } from '@/components/duel/BrowseCardActionGrid';
import { CopyDimQueryButton } from '@/components/items/CopyDimQueryButton';
import { DuelSetBlock } from '@/components/duel/DuelSetBlock';
import { OnlyRollBadge } from '@/components/duel/OnlyRollBadge';

export type ArmorCardVariant = 'duel' | 'browse' | 'compact';

export const MAX_VISIBLE_STATS = 6;

export type StatPillRole = 'primary' | 'secondary' | 'tertiary';

export interface CardStatEntry {
  stat: Stat;
  value: number;
  role: StatPillRole;
}

/** True when an intrinsic roll line is present on the piece (not absent / placeholder zero). */
export function hasIntrinsicStatLine(
  roll: Partial<Record<Stat, number>>,
  stat: Stat,
): boolean {
  return (roll[stat] ?? 0) > 0;
}

/** Archetype primary, secondary, and tertiary intrinsic roll lines (tuning shown separately). */
export function cardStatsForPiece(piece: ArmorPiece): CardStatEntry[] {
  const roll = intrinsicStats(piece);
  const [primary, secondary] = ARCHETYPE_STATS[piece.archetype];
  const candidates: CardStatEntry[] = [
    { stat: primary, value: roll[primary] ?? 0, role: 'primary' },
    { stat: secondary, value: roll[secondary] ?? 0, role: 'secondary' },
    { stat: piece.tertiaryStat, value: roll[piece.tertiaryStat] ?? 0, role: 'tertiary' },
  ];
  return candidates.filter((entry) => hasIntrinsicStatLine(roll, entry.stat));
}

export function partitionCardStats(
  entries: CardStatEntry[],
  max = MAX_VISIBLE_STATS,
): { visible: CardStatEntry[]; overflow: number } {
  if (entries.length <= max) return { visible: entries, overflow: 0 };
  return { visible: entries.slice(0, max), overflow: entries.length - max };
}

function TierBadge({ tier }: { tier: number | null }) {
  const label = formatArmorTierBadge(tier);
  if (!label || !hasDisplayTier(tier)) return null;
  return (
    <span
      className="text-[10px] uppercase tracking-wider text-muted tabular-nums"
      title={`Tier ${tier}`}
    >
      {label}
    </span>
  );
}

interface ArmorCardProps {
  piece: ArmorPiece;
  opponent?: ArmorPiece;
  breakdown?: ScoreBreakdown;
  selected?: boolean;
  onSelect?: () => void;
  statCompare?: Partial<Record<Stat, 'win' | 'lose' | 'tie'>>;
  variant?: ArmorCardVariant;
  recommended?: boolean;
  /** When true, render a non-interactive div (e.g. inside popovers). */
  static?: boolean;
  /** Relative match label for browse cards (rendered in footer, not on icon). */
  wantLabel?: WantLabel;
  /** Browse: show preference match % in the header instead of power alone. */
  preferMatchScore?: boolean;
  /** Duel: class prefs for preferred-set highlighting. */
  classPrefs?: ClassPreferenceProfile;
  /** Duel: vault items for resolving full set perk text. */
  allItems?: ArmorPiece[];
  /** Duel: dupe rules for only-roll badge. */
  dupeRules?: DupeRuleConfig;
  /** Duel: ids to omit from only-roll peer count (junked/eliminated this bucket). */
  excludeInstanceIds?: string[];
  /** Identical roll copies in scope - badge on icon top-left when > 1. */
  copyCount?: number;
  copyCountTitle?: string;
  className?: string;
  onToggleKeep?: (piece: ArmorPiece) => void;
  onToggleFavorite?: (piece: ArmorPiece) => void;
  onToggleJunk?: (piece: ArmorPiece) => void;
}

function OverflowPill({ count }: { count: number }) {
  return (
    <span
      title={`${count} more stats`}
      className="inline-flex items-center text-[10px] px-1.5 py-1 rounded-md bg-white/5 text-muted shrink-0"
    >
      +{count}
    </span>
  );
}

export function TuningBadge({ stat, differs }: { stat: Stat; differs?: boolean }) {
  const label = statLabel(stat);
  const text = `Tuning: ${label}`;
  return (
    <span
      title={text}
      aria-label={text}
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-1 rounded-md shrink-0 ${
        differs
          ? 'bg-white/10 ring-1 ring-white/15 text-white/90'
          : 'bg-white/[0.03] ring-1 ring-white/5 text-muted'
      }`}
    >
      <StatIcon stat={stat} size="sm" variant="glyph" />
      <span className="leading-none">{text}</span>
    </span>
  );
}

export function StatPill({
  stat,
  value,
  role,
  highlight,
  compact,
}: {
  stat: Stat;
  value: number;
  role?: StatPillRole;
  highlight?: 'win' | 'lose' | 'tie';
  compact?: boolean;
}) {
  const label = statLabel(stat);
  const muted = role === 'tertiary';
  const title = `${label} ${value}`;

  return (
    <span
      title={title}
      aria-label={title}
      className={`inline-flex items-center gap-1 font-medium rounded-md shrink-0 ${
        compact ? 'text-[10px] px-1 py-0.5' : 'text-xs px-1.5 py-1'
      } ${
        highlight === 'win'
          ? 'bg-white/10 ring-1 ring-white/15'
          : highlight === 'lose'
            ? 'bg-white/[0.03] ring-1 ring-white/5 opacity-70'
            : highlight === 'tie'
              ? 'bg-white/[0.03] ring-1 ring-white/5'
              : muted
                ? 'bg-white/[0.03] ring-1 ring-white/5'
                : 'bg-white/5'
      }`}
    >
      <StatIcon stat={stat} size="sm" variant="glyph" />
      <span className={`leading-none ${muted ? 'text-muted/80' : 'text-muted'}`}>{label}</span>
      <span
        className={`tabular-nums leading-none ${
          highlight === 'lose' || highlight === 'tie' || muted ? 'text-muted' : 'text-white/90'
        }`}
      >
        {value}
      </span>
    </span>
  );
}

function DiffRow({
  label,
  value,
  other,
  delta,
  emphasize,
}: {
  label: string;
  value: string | number;
  other: string | number;
  delta?: number;
  emphasize?: boolean;
}) {
  const wins = delta !== undefined ? delta > 0 : emphasize;
  const loses = delta !== undefined ? delta < 0 : false;
  return (
    <div
      className={`flex items-center justify-between gap-2 text-sm py-1.5 px-2 rounded-md ${
        wins ? 'bg-white/8 ring-1 ring-white/10' : loses ? 'bg-white/[0.02] opacity-75' : 'bg-white/5'
      }`}
    >
      <span className="text-muted text-xs uppercase tracking-wide">{label}</span>
      <span className={`font-medium tabular-nums ${wins ? 'text-white' : ''}`}>
        {value}
        {other !== value && (
          <>
            <span className="text-muted mx-1.5 text-xs">vs</span>
            <span className="text-muted">{other}</span>
          </>
        )}
        {delta !== undefined && delta !== 0 && (
          <span
            className={`ml-2 text-xs ${delta > 0 ? 'text-white' : 'text-muted'}`}
          >
            {delta > 0 ? '+' : ''}
            {delta}
          </span>
        )}
      </span>
    </div>
  );
}

function SameRollBadge({ label, helper }: { label: string; helper: string }) {
  return (
    <div
      className="w-full rounded-md border border-white/35 bg-white/[0.1] px-3 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      title={helper}
      role="status"
    >
      <div className="inline-flex items-center justify-center gap-2 text-xs font-semibold text-white uppercase tracking-widest">
        <span
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/50 bg-white/15 text-[10px] font-bold leading-none"
          aria-hidden
        >
          =
        </span>
        {label}
      </div>
      <p className="mt-1 text-[10px] leading-snug text-white/60">{helper}</p>
    </div>
  );
}

function isPreferredOverOpponent(
  piece: ArmorPiece,
  opponent: ArmorPiece,
  prefs: ClassPreferenceProfile | undefined,
): boolean {
  if (!prefs) return false;
  const selfWeight = preferredSetWeight(piece, prefs);
  const oppWeight = preferredSetWeight(opponent, prefs);
  return selfWeight > oppWeight;
}

export function ArmorCard({
  piece,
  opponent,
  breakdown,
  selected,
  onSelect,
  statCompare,
  variant = 'browse',
  recommended,
  static: isStatic = false,
  wantLabel,
  preferMatchScore = false,
  classPrefs,
  allItems,
  dupeRules,
  excludeInstanceIds,
  copyCount,
  copyCountTitle,
  className = '',
  onToggleKeep,
  onToggleFavorite,
  onToggleJunk,
}: ArmorCardProps) {
  const { t } = useTranslation('duel');
  const isDuel = variant === 'duel' && opponent;
  const diffs = isDuel ? armorDiffLines(piece, opponent) : [];
  const statDiffs = diffs.filter((d) => d.kind === 'stat');
  const metaDiffs = diffs.filter(
    (d) => d.kind !== 'stat' && d.kind !== 'set' && d.kind !== 'power',
  );
  const sameIntrinsicRoll = isDuel ? intrinsicStatsEqual(piece, opponent) : false;
  const setsDiffer =
    isDuel && (piece.armorSet?.hash ?? null) !== (opponent.armorSet?.hash ?? null);
  const setInfo =
    isDuel && allItems ? resolveArmorSetInfo(allItems, piece) : piece.armorSet;
  const setName = setInfo?.name ?? piece.armorSet?.name ?? armorDiffNoSetCopy();
  const setPreferred = isDuel ? isPreferredOverOpponent(piece, opponent, classPrefs) : false;
  const tuningDiffers = isDuel && piece.tuningStat !== opponent.tuningStat;
  const sameRollBadge = isDuel ? sameRollBadgeCopy(piece, opponent) : '';
  const sameRollHelper = isDuel ? sameRollHelperCopy(piece, opponent) : '';
  const onlyRoll =
    isDuel && dupeRules && allItems
      ? isSingletonRoll(piece, allItems, dupeRules, {
          excludeInstanceIds: excludeInstanceIds?.length ? excludeInstanceIds : undefined,
        })
      : false;

  const cardStats = cardStatsForPiece(piece);
  const { visible: statsToShow, overflow: statsOverflow } = partitionCardStats(cardStats);
  const subtitle = buildArmorSubtitle(piece);
  const showBrowseFooter = variant === 'browse';
  const showBrowseTagActions =
    showBrowseFooter &&
    onToggleKeep != null &&
    onToggleFavorite != null &&
    onToggleJunk != null;

  const cardClassName = `ui-card cursor-pointer text-left w-full h-full flex flex-col transition-all ${className} ${
    selected
      ? 'ui-card--selected ring-2 ring-white/20'
      : recommended
        ? 'ui-card--recommended'
        : ''
  }`;

  const cardBody = (
      <div className="flex gap-3 flex-1 min-h-0 w-full">
        <ItemIcon
          piece={piece}
          size={isDuel ? 'lg' : 'md'}
          copyCount={copyCount}
          copyCountTitle={copyCountTitle}
        />

        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-white truncate leading-tight" title={piece.name}>
                {piece.name}
              </div>
              {variant !== 'duel' && (
                <div className="text-xs text-muted mt-0.5 truncate capitalize" title={subtitle}>
                  {subtitle}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-0.5 shrink-0">
              {variant !== 'browse' && (
                <CopyDimQueryButton instanceId={piece.instanceId} itemName={piece.name} />
              )}
              {variant === 'duel' && hasDisplayTier(piece.tier) && (
                <TierBadge tier={piece.tier} />
              )}
              {variant === 'duel' && onlyRoll && (
                <OnlyRollBadge tooltip={onlyRollTooltip(piece)} />
              )}
              {variant !== 'duel' && preferMatchScore && breakdown && (
                <div className="text-right shrink-0">
                  <div
                    className="text-white/90 text-sm font-medium tabular-nums"
                    title={t('compare.fitTitle')}
                  >
                    {formatMatchScore(breakdown)}
                  </div>
                  <div className="text-[10px] text-muted tabular-nums" title={t('compare.powerTitle')}>
                    PL {piece.power}
                  </div>
                </div>
              )}
              {variant !== 'duel' && !(preferMatchScore && breakdown) && (
                <div
                  className="text-white/90 text-sm font-medium tabular-nums"
                  title={t('compare.powerTitle')}
                >
                  {piece.power}
                </div>
              )}
            </div>
          </div>

          {isDuel && (
            <DuelSetBlock
              setInfo={setInfo}
              setName={setName}
              preferred={setPreferred}
              differsFromOpponent={setsDiffer}
            />
          )}

          {isDuel && metaDiffs.length > 0 && (
            <div className="mt-2 space-y-1">
              {metaDiffs.map((d) => (
                <DiffRow
                  key={d.label}
                  label={d.label}
                  value={d.value}
                  other={d.other}
                  delta={d.delta}
                  emphasize={d.kind === 'tuning'}
                />
              ))}
            </div>
          )}

          {isDuel && sameIntrinsicRoll && (
            <div className="mt-2 shrink-0">
              <SameRollBadge label={sameRollBadge} helper={sameRollHelper} />
            </div>
          )}

          <div className="armor-card-stats flex flex-wrap gap-1.5 mt-2 shrink-0">
            {isDuel &&
              statsToShow.map((entry) => {
                const cmp = statCompare?.[entry.stat];
                const diffLine = statDiffs.find((d) => d.stat === entry.stat);
                const highlight = sameIntrinsicRoll
                  ? 'tie'
                  : cmp ??
                    (diffLine?.delta !== undefined
                      ? diffLine.delta > 0
                        ? 'win'
                        : diffLine.delta < 0
                          ? 'lose'
                          : 'tie'
                      : undefined);
                return (
                  <StatPill
                    key={`${entry.role}-${entry.stat}`}
                    stat={entry.stat}
                    value={entry.value}
                    role={entry.role}
                    highlight={highlight}
                  />
                );
              })}
            {!isDuel &&
              statsToShow.map((entry) => (
                <StatPill
                  key={`${entry.role}-${entry.stat}`}
                  stat={entry.stat}
                  value={entry.value}
                  role={entry.role}
                  compact={variant === 'compact'}
                />
              ))}
            {statsOverflow > 0 && <OverflowPill count={statsOverflow} />}
            {piece.tuningStat && (
              <TuningBadge stat={piece.tuningStat} differs={isDuel && tuningDiffers} />
            )}
          </div>

          {showBrowseFooter && (
            <div className="mt-auto pt-2 shrink-0 flex flex-col gap-2">
              <div className="min-h-[1.375rem] flex items-center flex-wrap gap-2">
                {wantLabel && <WantLabelBadge label={wantLabel} />}
                {breakdown && !wantLabel && !preferMatchScore && (
                  <span className="text-xs font-medium text-white/80">
                    {formatMatchScore(breakdown)}
                  </span>
                )}
              </div>
              {showBrowseTagActions && (
                <BrowseCardActionGrid
                  piece={piece}
                  onToggleKeep={onToggleKeep}
                  onToggleFavorite={onToggleFavorite}
                  onToggleJunk={onToggleJunk}
                />
              )}
            </div>
          )}
        </div>
      </div>
  );

  if (isStatic) {
    return <div className={cardClassName}>{cardBody}</div>;
  }

  return (
    <button type="button" onClick={onSelect} className={cardClassName}>
      {cardBody}
    </button>
  );
}

export function statCompareMap(
  self: ArmorPiece,
  other: ArmorPiece,
): Partial<Record<Stat, 'win' | 'lose' | 'tie'>> {
  const out: Partial<Record<Stat, 'win' | 'lose' | 'tie'>> = {};
  for (const s of STATS) {
    const delta = intrinsicStatDelta(self, other, s);
    if (delta > 0) out[s] = 'win';
    else if (delta < 0) out[s] = 'lose';
    else if ((intrinsicStats(self)[s] ?? 0) > 0) out[s] = 'tie';
  }
  return out;
}

export interface ComparePiecesOptions {
  dupeRules?: DupeRuleConfig;
  excludeInstanceIds?: Iterable<string>;
}

export function comparePieces(
  a: ArmorPiece,
  b: ArmorPiece,
  prefs: ClassPreferenceProfile,
  allItems: ArmorPiece[],
  options?: ComparePiecesOptions,
): {
  recommended: 'a' | 'b' | 'tie';
  breakdownA: ScoreBreakdown;
  breakdownB: ScoreBreakdown;
  suggestionSuppressed: boolean;
  identicalRolls: boolean;
} {
  const identicalRolls = isFullyIdenticalDuel(a, b);
  const peerDuel = intrinsicStatsEqual(a, b);
  const scoreOpts = peerDuel ? { peerDuel: true, ignoreDominance: true } : undefined;
  const breakdownA = scoreItem(a, prefs, allItems, scoreOpts);
  const breakdownB = scoreItem(b, prefs, allItems, scoreOpts);

  let recommended: 'a' | 'b' | 'tie';
  if (identicalRolls) {
    recommended = 'tie';
  } else {
    const diff = breakdownA.total - breakdownB.total;
    if (Math.abs(diff) >= 0.02) {
      recommended = diff > 0 ? 'a' : 'b';
    } else {
      const optimalDiff = compareBuildOptimalKeepPriority(a, b, prefs);
      if (optimalDiff !== 0) {
        recommended = optimalDiff > 0 ? 'a' : 'b';
      } else if (peerDuel) {
        const keepDiff = compareRedundantKeepPriority(a, b, prefs);
        recommended = keepDiff === 0 ? 'tie' : keepDiff > 0 ? 'a' : 'b';
      } else {
        recommended = 'tie';
      }
    }
  }

  let suggestionSuppressed = false;
  if (
    !identicalRolls &&
    options?.dupeRules &&
    recommended !== 'tie' &&
    shouldSuppressDuelSuggestion(a, b, breakdownA, breakdownB, allItems, options.dupeRules, {
      excludeInstanceIds: options.excludeInstanceIds,
    })
  ) {
    recommended = 'tie';
    suggestionSuppressed = true;
  }

  return {
    recommended,
    breakdownA,
    breakdownB,
    suggestionSuppressed,
    identicalRolls,
  };
}
