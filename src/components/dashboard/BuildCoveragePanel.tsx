import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { statLabel, slotLabel } from '@/i18n/gameCopy';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  coverageGapDetailCopy,
  patternColumnTitlePartsCopy,
  patternCollapsedSetRowTitleCopy,
  rollAnyTertiaryLabelCopy,
  rollStatRoleLabelCopy,
  rollStatRoleTitleCopy,
  rollTertiaryStatLabelCopy,
  rollTuningStatLabelCopy,
} from '@/i18n/buildCopy';
import { useVaultInteractionHold } from '@/hooks/useVaultRefreshGuard';
import { BUILD_QUERY_PARAM, desiredBuildsEditorPath, resolveCombosBuildId } from '@/lib/nav';
import { COMBOS_SECTION_ID, scrollToHashElement } from '@/lib/nav/hashScroll';
import {
  formatSetBonusTargetsSummary,
  isSetTargetPiece,
  parseSetBonusTargets,
  resolveSetName,
} from '@/lib/coverage/setBonus';
import { computePopoverPosition } from '@/components/dominance/DominatorPopover';
import { SlotIcon } from '@/components/SlotIcon';
import { StatIcon } from '@/components/StatIcon';
import { ArmorSetIcons, ComboTargetIcons } from '@/components/ArmorSetIcons';
import { ItemIcon } from '@/components/items/ItemIcon';
import { CopyDimQueriesButton, CopyDimQueryButton } from '@/components/items/CopyDimQueryButton';
import {
  LOADOUT_ACTION_CELL_CLASS,
  LOADOUT_ACTION_CHOOSE_CELL_CLASS,
  LOADOUT_ACTION_GRID_CLASS,
  LOADOUT_ACTION_PLACEHOLDER_CLASS,
  LOADOUT_LEFT_CLUSTER_CLASS,
  LOADOUT_META_LINE_CLASS,
  LOADOUT_NAME_CLASS,
  LOADOUT_ROW_INNER_CLASS,
  LOADOUT_SLOT_ROW_SHELL,
  LOADOUT_TEXT_BLOCK_CLASS,
  loadoutChooseBtnClass,
  rollPatternActionRailStyle,
  rollPatternColumnsGridClass,
  rollPatternLoadoutColumnGridStyle,
  rollPatternLoadoutCollapsedColumnGridStyle,
  rollPatternLoadoutSetRowStyle,
  measureLoadoutPickerMenuWidthPx,
  rollPatternPickerActionRailStyle,
  rollPatternPickerSlotRowInnerStyle,
  rollPatternSlotRowInnerStyle,
  shouldSplitRollChipsInSetRow,
} from '@/components/dashboard/buildCoverageLayout';
import { formatArmorTierBadge, hasDisplayTier } from '@/lib/armor/tier';
import { armorHasDimFavorite } from '@/lib/dim/parseTags';
import { TagActionButton } from '@/components/items/TagActionButton';
import {
  tagActionFavoriteActive,
  tagActionJunkActive,
  tagActionKeepActive,
} from '@/lib/dim/tagConfig';
import {
  analyzeCoverage,
  formatSetBonusProgressLabel,
  formatSetBonusVaultReachLabel,
  deriveOptimalRollPatterns,
  formatEmptyPatternSlotAriaLabel,
  formatEmptyPatternSlotMessage,
  archetypeIrrelevantSecondary,
  archetypePriorityIntrinsics,
  normalizeDesiredBuilds,
  rollPatternStatBonuses,
  orderEligiblePiecesForSlotPicker,
  resolveEffectiveRollPatternSlotRepresentatives,
  type OptimalRollPattern,
  type PatternSlotLoadoutEntry,
  type RollStatRole,
} from '@/lib/coverage/analyze';
import type {
  CoverageAnalysis,
  EligibleLoadoutPiece,
} from '@/lib/coverage/analyze';
import { defaultStatTargetsFromPrefs, resolveDesiredBuild, resolveDesiredBuildFromParam } from '@/lib/coverage/builds';
import {
  buildPatternLoadoutGridData,
  buildMergedGroupedSlotRows,
  collectRecommendedPatternGridPieces,
  countGroupPerfectSlots,
  countOverallPerfectSlotsInSetRow,
  countUniqueSetPiecesInPatternGrid,
  groupPatternLoadoutColumnsIntoOne,
  mergeGroupedEligibleBySlot,
  patternSetRowColumnsAreCollapsible,
  resolveGroupedSlotSelectionColumn,
  type PatternColumnSlotRow,
  type PatternColumnGroup,
} from '@/lib/coverage/patternLoadoutGrid';
import {
  readCoverageColumnLayout,
  writeCoverageColumnLayout,
  type CoverageColumnLayout,
} from '@/lib/coverage/columnLayoutPreference';
import { planBulkDimTagApply } from '@/lib/dim/bulkTagPlan';
import {
  fingerprintArmorItems,
  fingerprintRollRepresentatives,
  getCachedComboBadgeCounts,
  getCachedDesiredBuildAnalyses,
  getOrComputeVaultCache,
  patternGridCacheKey,
} from '@/lib/coverage/vaultComputeCache';
import { updateClassPrefs } from '@/lib/prefs/profile';
import { usePrefsStore, useSessionStore } from '@/stores';
import type {
  Archetype,
  ArmorPiece,
  ArmorSlot,
  ClassPreferenceProfile,
  ClassType,
  ClassVaultState,
  Stat,
  TagValue,
} from '@/types';

interface BuildCoveragePanelProps {
  classState: ClassVaultState;
  classType: ClassType;
  prefs: ClassPreferenceProfile;
}

function RecommendedPiecesBulkActions({
  dimCopyInstanceIds,
  taggablePieces,
  onBulkKeep,
  onBulkFavorite,
  onBulkJunk,
}: {
  dimCopyInstanceIds: readonly string[];
  taggablePieces: readonly ArmorPiece[];
  onBulkKeep: (pieces: readonly ArmorPiece[]) => void;
  onBulkFavorite: (pieces: readonly ArmorPiece[]) => void;
  onBulkJunk: (pieces: readonly ArmorPiece[]) => void;
}) {
  const { t } = useTranslation('build');
  const tagCount = taggablePieces.length;
  const allKeep =
    tagCount > 0 && taggablePieces.every((piece) => tagActionKeepActive(piece));
  const allJunk =
    tagCount > 0 && taggablePieces.every((piece) => tagActionJunkActive(piece));
  const allFavorite =
    tagCount > 0 && taggablePieces.every((piece) => tagActionFavoriteActive(piece));
  const tagsDisabled = tagCount === 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className={LOADOUT_ACTION_CELL_CLASS}>
        <CopyDimQueriesButton
          compact
          instanceIds={dimCopyInstanceIds}
          disabled={dimCopyInstanceIds.length === 0}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-muted shrink-0">{t('coverage.tagAll')}</span>
        <div
          className={LOADOUT_ACTION_GRID_CLASS}
          style={{ gridTemplateColumns: 'repeat(3, var(--spacing-touch-sm))' }}
        >
          <div className={LOADOUT_ACTION_CELL_CLASS}>
            <TagActionButton
              compact
              tag="keep"
              active={allKeep}
              disabled={tagsDisabled}
              title={
                tagsDisabled
                  ? t('coverage.bulkNoTaggable')
                  : allKeep
                    ? t('coverage.bulkClearKeep')
                    : t('coverage.bulkMarkKeep')
              }
              onClick={() => onBulkKeep(taggablePieces)}
            />
          </div>
          <div className={LOADOUT_ACTION_CELL_CLASS}>
            <TagActionButton
              compact
              tag="favorite"
              active={allFavorite}
              locked={allFavorite}
              disabled={tagsDisabled}
              title={
                tagsDisabled
                  ? t('coverage.bulkNoTaggable')
                  : allFavorite
                    ? t('coverage.bulkAllFavorited')
                    : t('coverage.bulkMarkFavorite')
              }
              onClick={() => onBulkFavorite(taggablePieces)}
            />
          </div>
          <div className={LOADOUT_ACTION_CELL_CLASS}>
            <TagActionButton
              compact
              tag="junk"
              active={allJunk}
              disabled={tagsDisabled}
              title={
                tagsDisabled
                  ? t('coverage.bulkNoTaggable')
                  : allJunk
                    ? t('coverage.bulkClearJunk')
                    : t('coverage.bulkMarkJunk')
              }
              onClick={() => onBulkJunk(taggablePieces)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function browseBuildHref(classType: ClassType, buildId: string): string {
  return `/browse/${classType}?build=${encodeURIComponent(buildId)}`;
}

const patternChipBaseClass =
  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs leading-none';

function PatternRollSeparator() {
  return (
    <span className="text-white/30 text-[10px] select-none shrink-0" aria-hidden>
      ·
    </span>
  );
}

function PatternPriorityStatChip({ stat, bonus }: { stat: Stat; bonus: number }) {
  const { t } = useTranslation('build');
  return (
    <span
      title={t('coverage.archetypeBonus', { stat: statLabel(stat), bonus })}
      className={`${patternChipBaseClass} border-white/15 bg-white/[0.04] text-white/80`}
    >
      <StatIcon stat={stat} size="sm" variant="glyph" />
      <span>{statLabel(stat)}</span>
    </span>
  );
}

function PatternIrrelevantSecondaryChip({ stat }: { stat: Stat }) {
  const { t } = useTranslation('build');
  return (
    <span
      title={t('coverage.notComboPriority', { stat: statLabel(stat) })}
      className={`${patternChipBaseClass} border-white/8 bg-transparent text-white/35`}
    >
      <StatIcon stat={stat} size="sm" variant="glyph" className="opacity-60" />
      <span>{statLabel(stat)}</span>
    </span>
  );
}

function PatternRollRoleChip({ stat, role }: { stat: Stat; role: RollStatRole }) {
  return (
    <span
      title={rollStatRoleTitleCopy(stat, role)}
      className={`${patternChipBaseClass} border-white/12 bg-white/[0.03] text-white/75`}
    >
      <StatIcon stat={stat} size="sm" variant="glyph" />
      <span>{statLabel(stat)}</span>
      <span className="text-white/45">{rollStatRoleLabelCopy(role)}</span>
    </span>
  );
}

function PatternArchetypeChips({
  archetype,
  priorities,
}: {
  archetype: Archetype;
  priorities: Stat[];
}) {
  const intrinsics = archetypePriorityIntrinsics(archetype, priorities);
  const irrelevant = archetypeIrrelevantSecondary(archetype, priorities);
  if (intrinsics.length === 0 && irrelevant === null) return null;

  return (
    <>
      {intrinsics.map(({ stat, bonus }) => (
        <PatternPriorityStatChip key={stat} stat={stat} bonus={bonus} />
      ))}
      {irrelevant !== null && <PatternIrrelevantSecondaryChip stat={irrelevant} />}
    </>
  );
}

function PatternAnyTertiaryChip() {
  const { t } = useTranslation('build');
  return (
    <span
      title={rollAnyTertiaryLabelCopy()}
      className={`${patternChipBaseClass} border-white/10 bg-transparent text-white/50`}
    >
      <span>{t('coverage.rollRoleAnyTertiary')}</span>
    </span>
  );
}

function PatternRollRoleChips({
  tertiaryStat,
  tuningStat,
  splitRollChips = false,
}: {
  tertiaryStat: Stat | null;
  tuningStat: Stat;
  splitRollChips?: boolean;
}) {
  const showAnyTertiary = tertiaryStat === null;
  const bonuses = rollPatternStatBonuses(tertiaryStat, tuningStat, { forceSplit: splitRollChips });

  return (
    <>
      {showAnyTertiary && <PatternAnyTertiaryChip />}
      {showAnyTertiary && bonuses.length > 0 && <PatternRollSeparator />}
      {bonuses.map(({ stat, role }) => (
        <PatternRollRoleChip key={`${stat}-${role}`} stat={stat} role={role} />
      ))}
    </>
  );
}

function RollPatternColumnHeader({
  pattern,
  priorities,
  slotsFilled,
  setName,
  setHash,
  items = [],
  splitRollChips = false,
}: {
  pattern: OptimalRollPattern;
  priorities: Stat[];
  slotsFilled?: number;
  setName?: string;
  setHash?: number;
  items?: ArmorPiece[];
  splitRollChips?: boolean;
}) {
  const titleParts = patternColumnTitlePartsCopy(
    pattern.archetype,
    pattern.tertiaryStat,
    pattern.tuningStat,
  );
  const titleRollParts = [titleParts.tertiary, titleParts.tuning].filter(Boolean).join(' · ');
  const titleAria = `${titleParts.lead} · ${titleRollParts}${setName ? ` · ${setName}` : ''}`;

  const showArchetypeChips =
    pattern.archetype !== null &&
    (archetypePriorityIntrinsics(pattern.archetype, priorities).length > 0 ||
      archetypeIrrelevantSecondary(pattern.archetype, priorities) !== null);

  const rollBonuses = rollPatternStatBonuses(pattern.tertiaryStat, pattern.tuningStat, {
    forceSplit: splitRollChips,
  });
  const showChipRow =
    showArchetypeChips ||
    pattern.tertiaryStat === null ||
    rollBonuses.length > 0;

  return (
    <div
      className="flex min-w-0 flex-col gap-1"
      aria-label={titleAria}
    >
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-base font-semibold tracking-tight leading-snug text-white/90">
          {titleParts.lead}
          <span className="font-normal text-white/65">
            {titleParts.tertiary && ` · ${titleParts.tertiary}`}
            {` · ${titleParts.tuning}`}
          </span>
        </span>
        {slotsFilled !== undefined && (
          <span className="shrink-0 text-sm font-normal tabular-nums text-muted">
            {slotsFilled}/5
          </span>
        )}
        {setName && (
          <span className="inline-flex min-w-0 items-center gap-1 text-sm font-medium leading-snug text-muted">
            {setHash !== undefined && (
              <ArmorSetIcons setHash={setHash} items={items} size="sm" maxIcons={1} />
            )}
            {setName}
          </span>
        )}
      </div>
      {showChipRow && (
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
          {showArchetypeChips && pattern.archetype !== null && (
            <>
              <PatternArchetypeChips archetype={pattern.archetype} priorities={priorities} />
              <PatternRollSeparator />
            </>
          )}
          <PatternRollRoleChips
            tertiaryStat={pattern.tertiaryStat}
            tuningStat={pattern.tuningStat}
            splitRollChips={splitRollChips}
          />
        </div>
      )}
    </div>
  );
}

function CollapsedRollPatternColumnHeader({
  headerPattern,
  slotsFilled,
  setName,
  setHash,
  items = [],
}: {
  headerPattern: Pick<OptimalRollPattern, 'archetype' | 'tertiaryStat'>;
  slotsFilled?: number;
  setName?: string;
  setHash?: number;
  items?: ArmorPiece[];
}) {
  const title = patternCollapsedSetRowTitleCopy(headerPattern.archetype);
  const titleAria = `${title}${setName ? ` · ${setName}` : ''}`;

  return (
    <div className="flex min-w-0 flex-col" aria-label={titleAria}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0">
        <span className="text-base font-semibold tracking-tight leading-tight text-white/90">
          {title}
        </span>
        {slotsFilled !== undefined && (
          <span className="shrink-0 text-sm font-normal tabular-nums text-muted">
            {slotsFilled}/5
          </span>
        )}
        {setName && (
          <span className="inline-flex min-w-0 items-center gap-1 text-sm font-medium leading-snug text-muted">
            {setHash !== undefined && (
              <ArmorSetIcons setHash={setHash} items={items} size="sm" maxIcons={1} />
            )}
            {setName}
          </span>
        )}
      </div>
    </div>
  );
}

function ColumnLayoutToggle({
  layout,
  onChange,
}: {
  layout: CoverageColumnLayout;
  onChange: (layout: CoverageColumnLayout) => void;
}) {
  const { t } = useTranslation('build');
  const baseBtn =
    'cursor-pointer rounded-md px-2 py-1 text-[10px] font-medium leading-none transition-colors';
  const activeBtn = `${baseBtn} bg-white/12 text-white ring-1 ring-white/20`;
  const idleBtn = `${baseBtn} text-muted hover:bg-white/[0.06] hover:text-white`;

  return (
    <div
      className="inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-white/[0.03] p-0.5 ring-1 ring-white/10"
      role="group"
      aria-label={t('coverage.columnLayoutToggle')}
      title={t('coverage.columnLayoutGroupHint')}
    >
      <button
        type="button"
        className={layout === 'split' ? activeBtn : idleBtn}
        aria-pressed={layout === 'split'}
        onClick={() => onChange('split')}
      >
        {t('coverage.columnLayoutSplit')}
      </button>
      <button
        type="button"
        className={layout === 'group' ? activeBtn : idleBtn}
        aria-pressed={layout === 'group'}
        onClick={() => onChange('group')}
      >
        {t('coverage.columnLayoutGroup')}
      </button>
    </div>
  );
}

function ChevronIcon({ open, className = '' }: { open: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden
      className={`block shrink-0 h-3 w-3 transition-transform ${open ? 'rotate-180' : ''} ${className}`}
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

const PICKER_MENU_MAX_HEIGHT = 280;
const PICKER_MENU_FALLBACK_WIDTH_PX = 480;

/** Portaled menu - elevated above page (see DominatorPopover / BucketPanel). */
const PICKER_MENU_BACKDROP_CLASS = 'fixed inset-0 z-[299] bg-black/45';
const PICKER_MENU_PANEL_CLASS =
  'fixed z-[300] flex min-h-0 flex-col overflow-hidden rounded-md border border-white/15 bg-surface-3 ring-1 ring-white/10 shadow-[0_16px_48px_-12px_rgb(0_0_0/0.72),0_4px_16px_-4px_rgb(0_0_0/0.5)]';

function computePickerMenuPosition(
  anchor: DOMRect,
  columnRect: DOMRect | null,
  popW: number,
  popH: number,
) {
  const base = computePopoverPosition(anchor, popW, popH);
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const alignRight = columnRect?.right ?? anchor.right;
  let x = alignRight - popW;
  x = Math.max(8, Math.min(x, vw - 8 - popW));
  return { ...base, x };
}

const LOADOUT_COLUMN_SELECTOR = '[data-loadout-column]';

function PiecePickerMetaLine({
  piece,
  isSetTarget = false,
  showTertiary = false,
  showTuning = false,
}: {
  piece: ArmorPiece;
  isSetTarget?: boolean;
  showTertiary?: boolean;
  showTuning?: boolean;
}) {
  const setName = piece.armorSet?.name;
  const tierLabel = hasDisplayTier(piece.tier) ? formatArmorTierBadge(piece.tier) : null;
  const tertiaryLabel = showTertiary ? rollTertiaryStatLabelCopy(piece.tertiaryStat) : null;
  const tuningLabel =
    showTuning && piece.tuningStat ? rollTuningStatLabelCopy(piece.tuningStat) : null;

  if (!tierLabel && !setName && !tertiaryLabel && !tuningLabel) {
    return null;
  }

  return (
    <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0 text-xs text-muted">
      {tierLabel && (
        <span className="shrink-0 tabular-nums" title={`Tier ${piece.tier}`}>
          {tierLabel}
        </span>
      )}
      {tertiaryLabel && (
        <span
          className="inline-flex min-w-0 shrink-0 items-center gap-1"
          title={tertiaryLabel}
        >
          <StatIcon stat={piece.tertiaryStat} size="sm" variant="glyph" />
          <span>{tertiaryLabel}</span>
        </span>
      )}
      {tuningLabel && piece.tuningStat && (
        <span
          className="inline-flex min-w-0 shrink-0 items-center gap-1"
          title={tuningLabel}
        >
          <StatIcon stat={piece.tuningStat} size="sm" variant="glyph" />
          <span>{tuningLabel}</span>
        </span>
      )}
      {setName && (
        <span
          className={`inline-flex min-w-0 items-center gap-1 truncate ${isSetTarget ? 'text-accent-dim font-medium' : ''}`}
          title={setName}
        >
          <ArmorSetIcons
            setHash={piece.armorSet!.hash}
            setInfo={piece.armorSet}
            size="sm"
            maxIcons={1}
          />
          {setName}
        </span>
      )}
    </div>
  );
}

function SlotRowMetaLine({
  piece,
  isNearMatch,
  nearMatchTitle,
  isSetTarget = false,
  showTertiaryLabel = false,
  showTuningLabel = false,
}: {
  piece: ArmorPiece;
  isNearMatch: boolean;
  nearMatchTitle?: string;
  isSetTarget?: boolean;
  showTertiaryLabel?: boolean;
  showTuningLabel?: boolean;
}) {
  if (isNearMatch) {
    return (
      <div className={LOADOUT_META_LINE_CLASS}>
        {piece.tertiaryStat && showTertiaryLabel && (
          <span className="text-xs text-muted" title={rollTertiaryStatLabelCopy(piece.tertiaryStat)}>
            {rollTertiaryStatLabelCopy(piece.tertiaryStat)}
          </span>
        )}
        {piece.tuningStat && (
          <span className="text-xs text-muted" title={nearMatchTitle}>
            {rollTuningStatLabelCopy(piece.tuningStat)}
          </span>
        )}
        <NearMatchTuneIndicator title={nearMatchTitle} />
      </div>
    );
  }

  return (
    <PiecePickerMetaLine
      piece={piece}
      isSetTarget={isSetTarget}
      showTertiary={showTertiaryLabel}
      showTuning={showTuningLabel}
    />
  );
}

function SlotPiecePickerMenu({
  open,
  anchorRef,
  slot,
  pattern,
  eligiblePieces,
  selectedInstanceId,
  onSelectPiece,
  onToggleKeep,
  onToggleFavorite,
  onToggleJunk,
  onClose,
  showTuningAlways = false,
  showTertiaryAlways = false,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  slot: ArmorSlot;
  pattern: OptimalRollPattern;
  eligiblePieces: EligibleLoadoutPiece[];
  selectedInstanceId: string;
  onSelectPiece: (instanceId: string) => void;
  onToggleKeep: (piece: ArmorPiece) => void;
  onToggleFavorite: (piece: ArmorPiece) => void;
  onToggleJunk: (piece: ArmorPiece) => void;
  onClose: () => void;
  showTuningAlways?: boolean;
  showTertiaryAlways?: boolean;
}) {
  const { t } = useTranslation('build');
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const displayPieces = orderEligiblePiecesForSlotPicker(eligiblePieces);
  const showFlexTertiary = pattern.tertiaryStat === null;
  const duplicateNameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { piece } of eligiblePieces) {
      counts.set(piece.name, (counts.get(piece.name) ?? 0) + 1);
    }
    return counts;
  }, [eligiblePieces]);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [menuWidthPx, setMenuWidthPx] = useState(0);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;
    const anchorRect = anchor.getBoundingClientRect();
    const columnEl = anchor.closest(LOADOUT_COLUMN_SELECTOR);
    const columnRect = columnEl?.getBoundingClientRect() ?? null;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const widthPx = measureLoadoutPickerMenuWidthPx(columnRect?.width ?? 0, vw);
    if (widthPx > 0) {
      setMenuWidthPx(widthPx);
    }
    const popW = widthPx > 0 ? widthPx : menu.offsetWidth || PICKER_MENU_FALLBACK_WIDTH_PX;
    const next = computePickerMenuPosition(
      anchorRect,
      columnRect,
      popW,
      menu.offsetHeight || 160,
    );
    setPos({ x: next.x, y: next.y });
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, eligiblePieces.length, updatePosition]);

  useEffect(() => {
    if (!open) return;
    // Use click (not mousedown) so row selection completes before dismiss.
    // Do not close on scroll: layout scroll between mousedown and click was
    // unmounting the menu and swallowing the selection click.
    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('click', onClickOutside);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', updatePosition, { passive: true });
    return () => {
      document.removeEventListener('click', onClickOutside);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, onClose, anchorRef, updatePosition]);

  if (!open) return null;

  return createPortal(
    <>
      <div
        className={PICKER_MENU_BACKDROP_CLASS}
        aria-hidden
        onClick={onClose}
      />
      <div
        ref={menuRef}
        id={listId}
        role="listbox"
        aria-label={t('coverage.chooseSlot', { slot: slotLabel(slot) })}
        className={PICKER_MENU_PANEL_CLASS}
        onMouseDown={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
        style={{
          left: pos.x,
          top: pos.y,
          width: menuWidthPx > 0 ? menuWidthPx : undefined,
          minWidth: menuWidthPx > 0 ? menuWidthPx : PICKER_MENU_FALLBACK_WIDTH_PX,
          maxWidth: menuWidthPx > 0 ? menuWidthPx : `min(${PICKER_MENU_FALLBACK_WIDTH_PX}px, calc(100vw - 16px))`,
          maxHeight: PICKER_MENU_MAX_HEIGHT,
        }}
      >
      <div className="shrink-0 border-b border-white/10 bg-white/[0.04] px-2.5 py-1.5">
        <p className="text-[10px] font-medium uppercase tracking-wide text-white/45">
          {slotLabel(slot)}
        </p>
        <p className="text-[11px] text-white/70 tabular-nums">
          {t('coverage.eligible', { count: eligiblePieces.length })}
        </p>
      </div>
      <ul className="overflow-y-auto flex-1 min-h-0">
        {displayPieces.map(({ piece: altPiece }) => {
          const selected = altPiece.instanceId === selectedInstanceId;
          const showTuning =
            showTuningAlways || (duplicateNameCounts.get(altPiece.name) ?? 0) > 1;
          const showTertiary = showTertiaryAlways || showFlexTertiary;
          const selectRow = () => {
            onSelectPiece(altPiece.instanceId);
            onClose();
          };
          const rowClass =
            'box-border h-16 min-h-16 max-h-16 overflow-hidden border-b border-white/10 last:border-b-0 transition-colors cursor-pointer hover:bg-white/[0.03]';
          return (
            <li
              key={altPiece.instanceId}
              role="option"
              aria-selected={selected}
              tabIndex={0}
              className={rowClass}
              onClick={selectRow}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  selectRow();
                }
              }}
            >
              <div
                className={LOADOUT_ROW_INNER_CLASS}
                style={rollPatternPickerSlotRowInnerStyle()}
              >
                <div className={LOADOUT_LEFT_CLUSTER_CLASS}>
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${selected ? 'bg-accent' : 'opacity-0'}`}
                    aria-hidden
                  />
                  <ItemIcon piece={altPiece} size="loadout" buildOptimal={false} />
                </div>
                <div className={LOADOUT_TEXT_BLOCK_CLASS}>
                  <span className={LOADOUT_NAME_CLASS} title={altPiece.name}>
                    {altPiece.name}
                  </span>
                  <div className={LOADOUT_META_LINE_CLASS}>
                    <PiecePickerMetaLine
                      piece={altPiece}
                      showTertiary={showTertiary}
                      showTuning={showTuning}
                    />
                  </div>
                </div>
                <PatternLoadoutActionGrid
                  railVariant="picker"
                  piece={altPiece}
                  mode="full"
                  hasAlternatives={false}
                  eligibleCount={0}
                  pickerOpen={false}
                  onToggleChoose={() => {}}
                  pickerTriggerRef={anchorRef}
                  stopRowActivation
                  onToggleKeep={onToggleKeep}
                  onToggleFavorite={onToggleFavorite}
                  onToggleJunk={onToggleJunk}
                />
              </div>
            </li>
          );
        })}
      </ul>
      </div>
    </>,
    document.body,
  );
}

function NearMatchTuneIndicator({ title }: { title?: string }) {
  if (!title) return null;
  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border/60 bg-white/[0.03] text-muted"
      title={title}
      aria-label={title}
    >
      <svg width={10} height={10} viewBox="0 0 12 12" aria-hidden className="block">
        <path
          d="M2.5 6h7M8.5 4 10.5 6 8.5 8"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </span>
  );
}

function LoadoutActionIconPlaceholder() {
  return (
    <div
      className={`${LOADOUT_ACTION_CELL_CLASS} ${LOADOUT_ACTION_PLACEHOLDER_CLASS}`}
      aria-hidden
    >
      <span className="ui-icon-btn ui-icon-btn--compact rounded border border-transparent" />
    </div>
  );
}

function LoadoutChoosePlaceholder() {
  const { t } = useTranslation('build');
  return (
    <div
      className={`${LOADOUT_ACTION_CHOOSE_CELL_CLASS} ${LOADOUT_ACTION_PLACEHOLDER_CLASS}`}
      aria-hidden
    >
      <span className={loadoutChooseBtnClass({ open: false })}>
        <span>{t('coverage.choose')}</span>
        <span className="tabular-nums opacity-0">0</span>
      </span>
    </div>
  );
}

function PatternLoadoutActionGrid({
  piece,
  mode,
  railVariant = 'slot',
  hasAlternatives,
  eligibleCount,
  pickerOpen,
  onToggleChoose,
  pickerTriggerRef,
  stopRowActivation = false,
  onToggleKeep,
  onToggleFavorite,
  onToggleJunk,
}: {
  piece?: ArmorPiece;
  mode: 'full' | 'empty';
  railVariant?: 'slot' | 'picker';
  hasAlternatives: boolean;
  eligibleCount: number;
  pickerOpen: boolean;
  onToggleChoose: () => void;
  pickerTriggerRef: React.RefObject<HTMLButtonElement | null>;
  /** Prevent picker list row from selecting when clicking tag/DIM controls. */
  stopRowActivation?: boolean;
  onToggleKeep: (piece: ArmorPiece) => void;
  onToggleFavorite: (piece: ArmorPiece) => void;
  onToggleJunk: (piece: ArmorPiece) => void;
}) {
  const { t } = useTranslation('build');
  const isPickerRail = railVariant === 'picker';
  const railStyle = isPickerRail ? rollPatternPickerActionRailStyle() : rollPatternActionRailStyle();
  const isolateActivation = stopRowActivation
    ? {
        onClick: (event: React.MouseEvent) => event.stopPropagation(),
        onMouseDown: (event: React.MouseEvent) => event.stopPropagation(),
      }
    : {};

  if (mode === 'empty' || !piece) {
    return (
      <div
        className={LOADOUT_ACTION_GRID_CLASS}
        style={railStyle}
        aria-hidden
        {...isolateActivation}
      >
        <LoadoutActionIconPlaceholder />
        <LoadoutActionIconPlaceholder />
        <LoadoutActionIconPlaceholder />
        <LoadoutActionIconPlaceholder />
        {!isPickerRail && <LoadoutChoosePlaceholder />}
      </div>
    );
  }

  const isTaggedKeep = tagActionKeepActive(piece);
  const isTaggedJunk = tagActionJunkActive(piece);
  const dimFavorite = tagActionFavoriteActive(piece);

  return (
    <div className={LOADOUT_ACTION_GRID_CLASS} style={railStyle} {...isolateActivation}>
      <div className={LOADOUT_ACTION_CELL_CLASS}>
        <CopyDimQueryButton compact instanceId={piece.instanceId} itemName={piece.name} />
      </div>
      <div className={LOADOUT_ACTION_CELL_CLASS}>
        <TagActionButton
          compact
          tag="keep"
          active={isTaggedKeep}
          title={isTaggedKeep ? t('coverage.tagKeepRemove') : t('coverage.tagKeep')}
          onClick={() => onToggleKeep(piece)}
        />
      </div>
      <div className={LOADOUT_ACTION_CELL_CLASS}>
        <TagActionButton
          compact
          tag="favorite"
          active={dimFavorite}
          locked={dimFavorite}
          title={dimFavorite ? t('coverage.tagFavoriteAlready') : t('coverage.tagFavorite')}
          onClick={() => onToggleFavorite(piece)}
        />
      </div>
      <div className={LOADOUT_ACTION_CELL_CLASS}>
        <TagActionButton
          compact
          tag="junk"
          active={isTaggedJunk}
          title={isTaggedJunk ? t('coverage.tagJunkRemove') : t('coverage.tagJunk')}
          onClick={() => onToggleJunk(piece)}
        />
      </div>
      {!isPickerRail &&
        (hasAlternatives ? (
          <div className={LOADOUT_ACTION_CHOOSE_CELL_CLASS}>
            <button
              ref={pickerTriggerRef}
              type="button"
              onClick={onToggleChoose}
              aria-haspopup="listbox"
              aria-expanded={pickerOpen}
              aria-label={t('coverage.choosePiece', { count: eligibleCount })}
              title={t('coverage.chooseEligibleTitle', { count: eligibleCount })}
              className={loadoutChooseBtnClass({ open: pickerOpen })}
            >
              <span>{t('coverage.choose')}</span>
              <span className="tabular-nums opacity-70">{eligibleCount}</span>
              <ChevronIcon open={pickerOpen} className="opacity-70" />
            </button>
          </div>
        ) : (
          <LoadoutChoosePlaceholder />
        ))}
    </div>
  );
}

function PatternSlotRow({
  slotEntry,
  pattern,
  priorities,
  setName,
  eligiblePieces,
  displayPiece,
  matchTier,
  onSelectPiece,
  onToggleKeep,
  onToggleFavorite,
  onToggleJunk,
  isSetTargetPiece: pieceIsSetTarget = false,
  isTopGoldColumnPiece = false,
  showColumnComboBadge = false,
  columnComboBadgeCount = 0,
  columnGoldTitle,
  columnComboTitle,
  nearMatchTitle,
  showTuningLabel = false,
  showTertiaryLabel = false,
  pickerShowTuningAlways = false,
  pickerShowTertiaryAlways = false,
}: {
  slotEntry: PatternSlotLoadoutEntry;
  pattern: OptimalRollPattern;
  priorities: Stat[];
  setName?: string;
  eligiblePieces: EligibleLoadoutPiece[];
  displayPiece: ArmorPiece | null;
  matchTier: 'perfect' | 'near' | null;
  onSelectPiece: (instanceId: string) => void;
  onToggleKeep: (piece: ArmorPiece) => void;
  onToggleFavorite: (piece: ArmorPiece) => void;
  onToggleJunk: (piece: ArmorPiece) => void;
  isSetTargetPiece?: boolean;
  isTopGoldColumnPiece?: boolean;
  showColumnComboBadge?: boolean;
  columnComboBadgeCount?: number;
  columnGoldTitle?: string;
  columnComboTitle?: string;
  nearMatchTitle?: string;
  showTuningLabel?: boolean;
  showTertiaryLabel?: boolean;
  pickerShowTuningAlways?: boolean;
  pickerShowTertiaryAlways?: boolean;
}) {
  const { slot } = slotEntry;
  const [pickerOpen, setPickerOpen] = useState(false);
  useVaultInteractionHold(pickerOpen);
  const pickerTriggerRef = useRef<HTMLButtonElement>(null);
  const hasAlternatives = eligiblePieces.length > 1;

  if (!displayPiece) {
    const emptyAriaLabel = formatEmptyPatternSlotAriaLabel(slot, pattern, {
      priorities,
      setName,
    });

    return (
      <div
        className={`${LOADOUT_SLOT_ROW_SHELL} border-b border-dashed border-border/35 last:border-b-0`}
      >
        <div
          className={`${LOADOUT_ROW_INNER_CLASS} bg-white/[0.02]`}
          style={rollPatternSlotRowInnerStyle()}
          aria-label={emptyAriaLabel}
          title={emptyAriaLabel}
        >
          <div
            className={`${LOADOUT_LEFT_CLUSTER_CLASS} opacity-45`}
            title={slotLabel(slot)}
          >
            <SlotIcon slot={slot} size="sm" />
          </div>
          <div className={LOADOUT_TEXT_BLOCK_CLASS}>
            <span className="block truncate text-sm font-normal leading-tight text-muted">
              {formatEmptyPatternSlotMessage(slot)}
            </span>
            <div className={LOADOUT_META_LINE_CLASS} aria-hidden>
              <span className="text-xs text-white/50">-</span>
            </div>
          </div>
          <PatternLoadoutActionGrid
            mode="empty"
            hasAlternatives={false}
            eligibleCount={0}
            pickerOpen={false}
            onToggleChoose={() => {}}
            pickerTriggerRef={pickerTriggerRef}
            onToggleKeep={onToggleKeep}
            onToggleFavorite={onToggleFavorite}
            onToggleJunk={onToggleJunk}
          />
        </div>
      </div>
    );
  }

  const piece = displayPiece;
  const isNearMatch = matchTier === 'near';

  const rowSurfaceClass = isNearMatch ? 'bg-white/[0.02]' : 'bg-white/[0.05]';

  const rowTooltip =
    isNearMatch && nearMatchTitle
      ? `${piece.name} · ${nearMatchTitle}`
      : piece.name;

  return (
    <div
      className={`${LOADOUT_SLOT_ROW_SHELL} border-b border-white/10 last:border-b-0`}
    >
      <div
        className={`${LOADOUT_ROW_INNER_CLASS} transition-colors ${rowSurfaceClass}`}
        style={rollPatternSlotRowInnerStyle()}
        title={isNearMatch ? rowTooltip : undefined}
      >
        <div
          className={`${LOADOUT_LEFT_CLUSTER_CLASS} ${isNearMatch ? 'opacity-45' : ''}`}
          title={slotLabel(slot)}
        >
          <SlotIcon slot={slot} size="sm" />
          <ItemIcon
            piece={piece}
            size="loadout"
            buildOptimal={showColumnComboBadge}
            buildOptimalCount={showColumnComboBadge ? Math.max(1, columnComboBadgeCount) : 0}
            buildOptimalVariant={isTopGoldColumnPiece ? 'sole' : 'default'}
            buildOptimalTitle={
              showColumnComboBadge
                ? (isTopGoldColumnPiece ? columnGoldTitle : columnComboTitle)
                : undefined
            }
          />
        </div>

        <div className={LOADOUT_TEXT_BLOCK_CLASS} title={isNearMatch ? rowTooltip : undefined}>
          <span
            className={
              isNearMatch
                ? 'block truncate text-sm font-normal leading-tight text-muted'
                : LOADOUT_NAME_CLASS
            }
            title={piece.name}
          >
            {piece.name}
          </span>
          <div className={LOADOUT_META_LINE_CLASS}>
            <SlotRowMetaLine
              piece={piece}
              isNearMatch={isNearMatch}
              nearMatchTitle={nearMatchTitle}
              isSetTarget={pieceIsSetTarget}
              showTertiaryLabel={showTertiaryLabel}
              showTuningLabel={showTuningLabel}
            />
          </div>
        </div>

        <PatternLoadoutActionGrid
          piece={piece}
          mode="full"
          hasAlternatives={hasAlternatives}
          eligibleCount={eligiblePieces.length}
          pickerOpen={pickerOpen}
          onToggleChoose={() => setPickerOpen((open) => !open)}
          pickerTriggerRef={pickerTriggerRef}
          onToggleKeep={onToggleKeep}
          onToggleFavorite={onToggleFavorite}
          onToggleJunk={onToggleJunk}
        />
      </div>

      {hasAlternatives && (
        <SlotPiecePickerMenu
          open={pickerOpen}
          anchorRef={pickerTriggerRef}
          slot={slot}
          pattern={pattern}
          eligiblePieces={eligiblePieces}
          selectedInstanceId={piece.instanceId}
          onSelectPiece={onSelectPiece}
          onToggleKeep={onToggleKeep}
          onToggleFavorite={onToggleFavorite}
          onToggleJunk={onToggleJunk}
          onClose={() => setPickerOpen(false)}
          showTuningAlways={pickerShowTuningAlways}
          showTertiaryAlways={pickerShowTertiaryAlways}
        />
      )}
    </div>
  );
}

const RollPatternColumn = memo(function RollPatternColumn({
  columnKey,
  pattern,
  focusStats,
  items,
  rows,
  eligibleBySlot,
  onSelectSlotPiece,
  onToggleKeep,
  onToggleFavorite,
  onToggleJunk,
  setTargets,
  globalGoldPlacements,
  setHash,
  setName,
  splitRollChips = false,
}: {
  columnKey: string;
  pattern: OptimalRollPattern;
  focusStats: Stat[];
  items: ArmorPiece[];
  rows: PatternColumnSlotRow[];
  eligibleBySlot: Partial<Record<ArmorSlot, EligibleLoadoutPiece[]>>;
  onSelectSlotPiece: (slot: ArmorSlot, instanceId: string) => void;
  onToggleKeep: (piece: ArmorPiece) => void;
  onToggleFavorite: (piece: ArmorPiece) => void;
  onToggleJunk: (piece: ArmorPiece) => void;
  setTargets: ReturnType<typeof parseSetBonusTargets>;
  globalGoldPlacements: ReadonlySet<string>;
  setHash?: number;
  setName?: string;
  splitRollChips?: boolean;
}) {
  const slotsFilled = rows.filter(
    (row) => row.displayPiece !== null && row.matchTier === 'perfect',
  ).length;
  const hasAnyPiece = rows.some((row) => row.displayPiece !== null);

  return (
    <div
      data-loadout-column
      className={`grid min-w-0 rounded-xl bg-surface/50 ring-1 ${hasAnyPiece ? 'ring-white/10' : 'ring-white/7'} backdrop-blur-sm`}
      style={rollPatternLoadoutColumnGridStyle()}
    >
      <div className="flex h-full min-h-0 max-h-[4.5rem] flex-col overflow-hidden border-b border-white/10 px-3 py-2.5">
        <RollPatternColumnHeader
          pattern={pattern}
          priorities={focusStats}
          slotsFilled={slotsFilled}
          setName={setName}
          setHash={setHash}
          items={items}
          splitRollChips={splitRollChips}
        />
      </div>

      {rows.map((row) => {
        const topGold =
          row.topGold && globalGoldPlacements.has(`${columnKey}|${row.slotEntry.slot}`);
        return (
          <PatternSlotRow
            key={row.slotEntry.slot}
            slotEntry={row.slotEntry}
            pattern={pattern}
            priorities={focusStats}
            setName={setName}
            displayPiece={row.displayPiece}
            matchTier={row.matchTier}
            eligiblePieces={eligibleBySlot[row.slotEntry.slot] ?? []}
            onSelectPiece={(instanceId) => onSelectSlotPiece(row.slotEntry.slot, instanceId)}
            onToggleKeep={onToggleKeep}
            onToggleFavorite={onToggleFavorite}
            onToggleJunk={onToggleJunk}
            isSetTargetPiece={
              row.matchTier === 'perfect' && isSetTargetPiece(row.displayPiece, setTargets)
            }
            isTopGoldColumnPiece={topGold}
            showColumnComboBadge={row.showComboBadge}
            columnComboBadgeCount={row.comboBadgeCount}
            columnGoldTitle={topGold ? row.columnGoldTitle : undefined}
            columnComboTitle={row.columnComboTitle}
            nearMatchTitle={row.nearMatchTitle}
          />
        );
      })}
    </div>
  );
});

const GroupedRollPatternColumn = memo(function GroupedRollPatternColumn({
  group,
  focusStats,
  items,
  mergedRows,
  eligibleBySlot,
  columnRowsByKey,
  onSelectSlotPiece,
  onToggleKeep,
  onToggleFavorite,
  onToggleJunk,
  setTargets,
  globalGoldPlacements,
  setHash,
  setName,
}: {
  group: PatternColumnGroup;
  focusStats: Stat[];
  items: ArmorPiece[];
  mergedRows: ReturnType<typeof buildMergedGroupedSlotRows>;
  eligibleBySlot: Partial<Record<ArmorSlot, EligibleLoadoutPiece[]>>;
  columnRowsByKey: Partial<Record<string, PatternColumnSlotRow[]>>;
  onSelectSlotPiece: (slot: ArmorSlot, instanceId: string) => void;
  onToggleKeep: (piece: ArmorPiece) => void;
  onToggleFavorite: (piece: ArmorPiece) => void;
  onToggleJunk: (piece: ArmorPiece) => void;
  setTargets: ReturnType<typeof parseSetBonusTargets>;
  globalGoldPlacements: ReadonlySet<string>;
  setHash?: number;
  setName?: string;
}) {
  const slotsFilled = countGroupPerfectSlots(group, columnRowsByKey);
  const hasAnyPiece = mergedRows.some((row) => row.displayPiece !== null);

  return (
    <div
      data-loadout-column
      className={`grid min-w-0 rounded-xl bg-surface/50 ring-1 ${hasAnyPiece ? 'ring-white/10' : 'ring-white/7'} backdrop-blur-sm`}
      style={rollPatternLoadoutCollapsedColumnGridStyle()}
    >
      <div className="flex min-h-0 flex-col justify-center overflow-hidden border-b border-white/10 px-3 py-1.5">
        <CollapsedRollPatternColumnHeader
          headerPattern={group.headerPattern}
          slotsFilled={slotsFilled}
          setName={setName}
          setHash={setHash}
          items={items}
        />
      </div>

      {mergedRows.map((row) => {
        const topGold =
          row.topGold && globalGoldPlacements.has(`${row.sourceColumnKey}|${row.slotEntry.slot}`);
        return (
          <PatternSlotRow
            key={row.slotEntry.slot}
            slotEntry={row.slotEntry}
            pattern={row.sourcePattern}
            priorities={focusStats}
            setName={setName}
            displayPiece={row.displayPiece}
            matchTier={row.matchTier}
            eligiblePieces={eligibleBySlot[row.slotEntry.slot] ?? []}
            onSelectPiece={(instanceId) => onSelectSlotPiece(row.slotEntry.slot, instanceId)}
            onToggleKeep={onToggleKeep}
            onToggleFavorite={onToggleFavorite}
            onToggleJunk={onToggleJunk}
            isSetTargetPiece={
              row.matchTier === 'perfect' && isSetTargetPiece(row.displayPiece, setTargets)
            }
            isTopGoldColumnPiece={topGold}
            showColumnComboBadge={row.showComboBadge}
            columnComboBadgeCount={row.comboBadgeCount}
            columnGoldTitle={topGold ? row.columnGoldTitle : undefined}
            columnComboTitle={row.columnComboTitle}
            nearMatchTitle={row.nearMatchTitle}
            showTertiaryLabel
            showTuningLabel
            pickerShowTertiaryAlways
            pickerShowTuningAlways
          />
        );
      })}
    </div>
  );
});

export function BuildCoveragePanel({
  classState,
  classType,
  prefs,
}: BuildCoveragePanelProps) {
  const { t } = useTranslation('build');
  const { applyTagDirect } = useSessionStore();
  const { updateProfile } = usePrefsStore();
  const hasSavedBuilds = normalizeDesiredBuilds(prefs.desiredBuilds, classType).length > 0;
  const allAnalyses = useMemo(
    () => getCachedDesiredBuildAnalyses(classState.items, classState.buckets, prefs, classType),
    [classState.items, classState.buckets, prefs, classType],
  );
  const itemsFingerprint = useMemo(
    () => fingerprintArmorItems(classState.items),
    [classState.items],
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const scrollToCombosEditor = useCallback(() => {
    const combosPath = `/combos/${classType}`;
    if (location.pathname === combosPath) {
      scrollToHashElement(`#${COMBOS_SECTION_ID}`);
      return;
    }
    navigate(desiredBuildsEditorPath(classType));
  }, [classType, location.pathname, navigate]);
  const enabledBuilds = useMemo(
    () => normalizeDesiredBuilds(prefs.desiredBuilds, classType).filter((b) => b.enabled !== false),
    [prefs.desiredBuilds, classType],
  );
  const activeBuildId = useMemo(
    () => resolveCombosBuildId(searchParams.get(BUILD_QUERY_PARAM), enabledBuilds, classType),
    [searchParams, enabledBuilds, classType],
  );
  const [showDetails, setShowDetails] = useState(false);
  const [columnLayout, setColumnLayout] = useState<CoverageColumnLayout>(() =>
    readCoverageColumnLayout(),
  );

  const setColumnLayoutPreference = useCallback((layout: CoverageColumnLayout) => {
    setColumnLayout(layout);
    writeCoverageColumnLayout(layout);
  }, []);

  useEffect(() => {
    const param = searchParams.get(BUILD_QUERY_PARAM);
    if (!param || enabledBuilds.length === 0) return;
    if (resolveCombosBuildId(param, enabledBuilds, classType) === param) return;
    const next = new URLSearchParams(searchParams);
    next.set(BUILD_QUERY_PARAM, enabledBuilds[0]!.id);
    setSearchParams(next, { replace: true });
  }, [searchParams, enabledBuilds, setSearchParams, classType]);

  const selectBuild = useCallback(
    (id: string) => {
      startTransition(() => {
        const next = new URLSearchParams(searchParams);
        next.set(BUILD_QUERY_PARAM, id);
        setSearchParams(next, { replace: true });
      });
    },
    [searchParams, setSearchParams],
  );

  const savedBuilds = useMemo(
    () => normalizeDesiredBuilds(prefs.desiredBuilds, classType),
    [prefs.desiredBuilds, classType],
  );

  const activeAnalysis = useMemo(() => {
    const match = allAnalyses.find(
      (a) => (a.build.desiredBuildId ?? a.build.id) === activeBuildId,
    );
    if (match) return match;

    const fromParam = resolveDesiredBuildFromParam(activeBuildId, classType, savedBuilds);
    if (fromParam) {
      return analyzeCoverage(
        classState.items,
        classState.buckets,
        resolveDesiredBuild(fromParam, prefs),
      );
    }

    return (
      allAnalyses[0] ??
      analyzeCoverage(classState.items, classState.buckets, {
        id: 'fallback',
        label: t('coverage.comboFallback'),
        statTargets: defaultStatTargetsFromPrefs(prefs),
      })
    );
  }, [
    allAnalyses,
    activeBuildId,
    classState.items,
    classState.buckets,
    prefs,
    classType,
    savedBuilds,
  ]);

  const build = activeAnalysis.build;
  const buildId = build.desiredBuildId ?? build.id;
  const desiredBuild = useMemo(
    () =>
      savedBuilds.find((b) => b.id === buildId) ??
      resolveDesiredBuildFromParam(buildId, classType, savedBuilds),
    [savedBuilds, buildId, classType],
  );
  const focusStats = useMemo(
    () => build.statTargets.map((t) => t.stat),
    [build.statTargets],
  );
  const setTargets = useMemo(
    () => parseSetBonusTargets(build.setBonus2pc, build.setBonus4pc),
    [build.setBonus2pc, build.setBonus4pc],
  );

  const patternSlotRepresentatives = useMemo(
    () =>
      resolveEffectiveRollPatternSlotRepresentatives(
        classState.items,
        focusStats,
        desiredBuild?.rollPatternSlotRepresentatives,
        desiredBuild?.rollPatternRepresentatives,
        desiredBuild?.tuningRepresentatives,
        desiredBuild?.slotRepresentatives,
        setTargets,
      ),
    [
      classState.items,
      focusStats,
      desiredBuild?.rollPatternSlotRepresentatives,
      desiredBuild?.rollPatternRepresentatives,
      desiredBuild?.tuningRepresentatives,
      desiredBuild?.slotRepresentatives,
      setTargets,
    ],
  );

  const comboBadgeCountByInstance = useMemo(
    () =>
      getCachedComboBadgeCounts(
        classState.items,
        allAnalyses.map((a) => a.build),
        allAnalyses.map((a) => a.build.desiredBuildId ?? a.build.id).join(','),
      ),
    [classState.items, allAnalyses],
  );

  const patternGrid = useMemo(() => {
    const gridKey = patternGridCacheKey({
      itemsFingerprint,
      buildId,
      focusStats,
      setBonus2pc: build.setBonus2pc,
      setBonus4pc: build.setBonus4pc,
      representativesFingerprint: fingerprintRollRepresentatives({
        rollPatternSlotRepresentatives: desiredBuild?.rollPatternSlotRepresentatives,
        rollPatternRepresentatives: desiredBuild?.rollPatternRepresentatives,
        tuningRepresentatives: desiredBuild?.tuningRepresentatives,
        slotRepresentatives: desiredBuild?.slotRepresentatives,
      }),
    });
    return getOrComputeVaultCache(gridKey, () =>
      buildPatternLoadoutGridData(
        classState.items,
        build,
        focusStats,
        setTargets,
        patternSlotRepresentatives,
        comboBadgeCountByInstance,
      ),
    );
  }, [
    itemsFingerprint,
    buildId,
    focusStats,
    build,
    setTargets,
    patternSlotRepresentatives,
    comboBadgeCountByInstance,
    desiredBuild?.rollPatternSlotRepresentatives,
    desiredBuild?.rollPatternRepresentatives,
    desiredBuild?.tuningRepresentatives,
    desiredBuild?.slotRepresentatives,
    classState.items,
  ]);

  const {
    recommendedPatternLoadout,
    loadoutSetRows,
    patternEligibleBySlot,
    globalGoldPlacements,
    columnRowsByKey,
  } = patternGrid;

  const patternGridSetProgress = useMemo(() => {
    if (setTargets.length === 0) return null;
    return setTargets.map((target) => {
      const slotsFilled = countUniqueSetPiecesInPatternGrid(
        recommendedPatternLoadout.columns,
        columnRowsByKey,
        target.hash,
      );
      return {
        hash: target.hash,
        name: resolveSetName(classState.items, target.hash),
        tier: target.pieces,
        required: target.pieces,
        slotsFilled,
        met: slotsFilled >= target.pieces,
      };
    });
  }, [setTargets, recommendedPatternLoadout.columns, columnRowsByKey]);

  function persistPatternSlotRepresentative(
    columnKey: string,
    patternKey: string,
    slot: ArmorSlot,
    instanceId: string | null,
  ) {
    updateProfile((profile) =>
      updateClassPrefs(profile, classType, (classPrefs) => {
        const builds = normalizeDesiredBuilds(classPrefs.desiredBuilds, classType);
        const nextBuilds = builds.map((b) => {
          if (b.id !== buildId) return b;
          const byPattern = { ...(b.rollPatternSlotRepresentatives ?? {}) };
          if (patternKey !== columnKey) {
            delete byPattern[patternKey];
          }
          const bySlot = { ...(byPattern[columnKey] ?? {}) };
          if (instanceId === null) {
            delete bySlot[slot];
          } else {
            bySlot[slot] = instanceId;
          }
          if (Object.keys(bySlot).length > 0) {
            byPattern[columnKey] = bySlot;
          } else {
            delete byPattern[columnKey];
          }
          return {
            ...b,
            rollPatternSlotRepresentatives:
              Object.keys(byPattern).length > 0 ? byPattern : undefined,
            rollPatternRepresentatives: undefined,
            tuningRepresentatives: undefined,
            slotRepresentatives: undefined,
          };
        });
        return { ...classPrefs, desiredBuilds: nextBuilds };
      }),
    );
  }

  const optimalRollPatterns = useMemo(
    () => deriveOptimalRollPatterns(focusStats),
    [focusStats],
  );

  const runDirectTag = useCallback(
    (piece: ArmorPiece, tag: TagValue | null) => {
      void applyTagDirect([piece], tag).catch((error: unknown) => {
        console.error(error);
      });
    },
    [applyTagDirect],
  );

  const toggleKeep = useCallback(
    (piece: ArmorPiece) => {
      runDirectTag(piece, piece.dimTag === 'keep' ? null : 'keep');
    },
    [runDirectTag],
  );

  const toggleFavorite = useCallback(
    (piece: ArmorPiece) => {
      if (armorHasDimFavorite(piece)) return;
      runDirectTag(piece, 'favorite');
    },
    [runDirectTag],
  );

  const toggleJunk = useCallback(
    (piece: ArmorPiece) => {
      runDirectTag(piece, piece.dimTag === 'junk' ? null : 'junk');
    },
    [runDirectTag],
  );

  const recommendedDimCopyPieces = useMemo(
    () =>
      collectRecommendedPatternGridPieces(
        recommendedPatternLoadout.columns,
        columnRowsByKey,
        { includeNearMatch: true },
      ),
    [recommendedPatternLoadout.columns, columnRowsByKey],
  );

  const recommendedTaggablePieces = useMemo(
    () =>
      collectRecommendedPatternGridPieces(
        recommendedPatternLoadout.columns,
        columnRowsByKey,
      ),
    [recommendedPatternLoadout.columns, columnRowsByKey],
  );

  const recommendedDimCopyInstanceIds = useMemo(
    () => recommendedDimCopyPieces.map((piece) => piece.instanceId),
    [recommendedDimCopyPieces],
  );

  const applyBulkRowTags = useCallback(
    (pieces: readonly ArmorPiece[], resolveTag: (piece: ArmorPiece) => TagValue | null) => {
      if (pieces.length === 0) return;
      const byTag = new Map<TagValue | null, ArmorPiece[]>();
      for (const piece of pieces) {
        const tag = resolveTag(piece);
        const group = byTag.get(tag) ?? [];
        group.push(piece);
        byTag.set(tag, group);
      }
      for (const [tag, group] of byTag) {
        void applyTagDirect(group, tag).catch((error: unknown) => {
          console.error(error);
        });
      }
    },
    [applyTagDirect],
  );

  const bulkKeep = useCallback(
    (pieces: readonly ArmorPiece[]) => {
      const plan = planBulkDimTagApply(pieces, 'keep');
      if (!plan) return;
      void applyTagDirect(plan.pieces, plan.tag).catch((error: unknown) => {
        console.error(error);
      });
    },
    [applyTagDirect],
  );

  const bulkFavorite = useCallback(
    (pieces: readonly ArmorPiece[]) => {
      const targets = pieces.filter((piece) => !armorHasDimFavorite(piece));
      applyBulkRowTags(targets, () => 'favorite');
    },
    [applyBulkRowTags],
  );

  const bulkJunk = useCallback(
    (pieces: readonly ArmorPiece[]) => {
      const plan = planBulkDimTagApply(pieces, 'junk');
      if (!plan) return;
      void applyTagDirect(plan.pieces, plan.tag).catch((error: unknown) => {
        console.error(error);
      });
    },
    [applyTagDirect],
  );

  const canGroupPatternColumns = useMemo(
    () =>
      loadoutSetRows.some((setRow) =>
        patternSetRowColumnsAreCollapsible(setRow.columns),
      ),
    [loadoutSetRows],
  );

  const effectiveColumnLayout: CoverageColumnLayout =
    canGroupPatternColumns && columnLayout === 'group' ? 'group' : 'split';

  if (!hasSavedBuilds) {
    return (
      <section className="mb-10 min-w-0 rounded-2xl bg-surface/60 px-4 py-4 sm:px-5 ring-1 ring-white/8">
        <h2 className="text-base font-semibold tracking-tight text-white">{t('coverage.heading')}</h2>
        <div className="mt-4 rounded-xl bg-black/15 px-4 py-4 ring-1 ring-white/10">
          <p className="max-w-lg text-sm text-muted">{t('coverage.empty')}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-10 min-w-0 rounded-2xl bg-surface/60 px-4 py-4 sm:px-5 ring-1 ring-white/8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-white">{t('coverage.heading')}</h2>
          <p className="mt-1 max-w-xl text-xs text-muted">{t('coverage.intro')}</p>
        </div>
        <button
          type="button"
          onClick={scrollToCombosEditor}
          className="cursor-pointer text-[11px] text-white/70 hover:text-white shrink-0 underline-offset-2 hover:underline"
        >
          {t('coverage.editCombos')}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {allAnalyses.map((analysis) => {
          const id = analysis.build.desiredBuildId ?? analysis.build.id;
          const active = id === buildId;
          const comboLabel = analysis.build.label;
          return (
            <button
              key={id}
              type="button"
              onClick={() => selectBuild(id)}
              className={`inline-flex w-auto max-w-full max-w-md min-w-0 flex-col cursor-pointer text-left rounded-lg px-3 py-2 transition-colors ring-1 ${
                active
                  ? 'bg-white/12 ring-white/25'
                  : 'bg-white/[0.03] ring-white/10 hover:bg-white/[0.06] hover:ring-white/18'
              }`}
            >
              <span
                className="block line-clamp-2 text-[11px] font-medium leading-snug text-white"
                title={comboLabel}
              >
                {comboLabel}
              </span>
              <span className="mt-1 inline-flex items-center gap-0.5">
                <ComboTargetIcons
                  setBonus2pc={analysis.build.setBonus2pc}
                  setBonus4pc={analysis.build.setBonus4pc}
                  items={classState.items}
                  size="sm"
                  statIcons={analysis.build.statTargets.map(({ stat }) => (
                    <StatIcon key={stat} stat={stat} size="sm" variant="glyph" />
                  ))}
                />
              </span>
            </button>
          );
        })}
      </div>

      {optimalRollPatterns.length === 0 && (
        <div className="mb-4 rounded-lg bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/10">
          <p className="text-sm font-medium text-white">{t('coverage.setPrioritiesHint')}</p>
        </div>
      )}

      <div className="mb-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white/95">{t('coverage.recommendedHeading')}</h3>
            <p className="mt-0.5 text-[10px] text-muted">{t('coverage.recommendedHint')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canGroupPatternColumns && (
              <ColumnLayoutToggle
                layout={effectiveColumnLayout}
                onChange={setColumnLayoutPreference}
              />
            )}
            <RecommendedPiecesBulkActions
              dimCopyInstanceIds={recommendedDimCopyInstanceIds}
              taggablePieces={recommendedTaggablePieces}
              onBulkKeep={bulkKeep}
              onBulkFavorite={bulkFavorite}
              onBulkJunk={bulkJunk}
            />
            <Link
              to={browseBuildHref(classType, buildId)}
              className="cursor-pointer text-[11px] text-white/70 hover:text-white underline-offset-2 hover:underline shrink-0"
            >
              {t('coverage.browseVault')}
            </Link>
          </div>
        </div>
        {(build.setBonus2pc !== undefined || build.setBonus4pc !== undefined) && (
          <div className="space-y-1 rounded-lg bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/10">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] text-muted">
                {t('coverage.setTarget')}{' '}
                <span className="text-white/90">
                  {formatSetBonusTargetsSummary(
                    build.setBonus2pc,
                    build.setBonus4pc,
                    classState.items,
                  )}
                </span>
              </p>
              <span className="inline-flex items-center gap-1.5">
                {setTargets.map((target) => (
                  <ArmorSetIcons
                    key={target.hash}
                    setHash={target.hash}
                    items={classState.items}
                    size="sm"
                    maxIcons={target.pieces === 4 ? 2 : 1}
                  />
                ))}
              </span>
            </div>
            {(patternGridSetProgress ?? activeAnalysis.setBonusReadiness.progress).map(
              (entry) => (
                <p
                  key={`${entry.hash}-${entry.tier}`}
                  className={`text-[11px] tabular-nums ${
                    entry.met ? 'text-white/90' : 'text-muted'
                  }`}
                >
                  {formatSetBonusProgressLabel(entry)}
                  {entry.met ? ' ✓' : ''}
                </p>
              ),
            )}
            {!activeAnalysis.setBonusReadiness.vaultTiersMet &&
              activeAnalysis.setBonusReadiness.vaultProgress
                .filter((entry) => !entry.met)
                .map((entry) => (
                  <p
                    key={`vault-${entry.hash}-${entry.tier}`}
                    className="text-[11px] text-danger/90"
                  >
                    {formatSetBonusVaultReachLabel(entry)} · {t('coverage.vaultPiecesShort')}
                  </p>
                ))}
            {activeAnalysis.setBonusReadiness.conflictingSets && (
              <p className="text-[11px] text-danger/90">
                {t('coverage.conflictingSets')}
              </p>
            )}
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-4">
          {loadoutSetRows.map((setRow) => {
            const collapsedGroup = groupPatternLoadoutColumnsIntoOne(setRow.columns);
            const displayUnits =
              effectiveColumnLayout === 'group'
                ? [
                    {
                      key: collapsedGroup.groupKey,
                      kind: 'group' as const,
                      group: collapsedGroup,
                      columnCount: setRow.columns.length,
                    },
                  ]
                : setRow.columns.map((column) => ({
                    key: column.columnKey,
                    kind: 'split' as const,
                    column,
                    columnCount: 1,
                  }));
            const showOverallCoverage = displayUnits.length > 1;
            const overallFilled = showOverallCoverage
              ? countOverallPerfectSlotsInSetRow(setRow.columns, columnRowsByKey)
              : 0;
            return (
              <div key={setRow.setKey} className="flex min-w-0 flex-col gap-1.5">
                {showOverallCoverage && (
                  <p className="text-sm font-medium tabular-nums text-white/80">
                    {t('coverage.overallCoverage', { filled: overallFilled, total: 5 })}
                  </p>
                )}
                <div
                  className={`grid min-w-0 items-stretch gap-3.5 ${rollPatternColumnsGridClass()}`}
                  style={rollPatternLoadoutSetRowStyle(displayUnits.length)}
                >
                  {effectiveColumnLayout === 'group'
                    ? (
                        <GroupedRollPatternColumn
                          key={collapsedGroup.groupKey}
                          group={collapsedGroup}
                          focusStats={focusStats}
                          items={classState.items}
                          mergedRows={buildMergedGroupedSlotRows(
                            collapsedGroup,
                            columnRowsByKey,
                          )}
                          eligibleBySlot={mergeGroupedEligibleBySlot(
                            collapsedGroup,
                            patternEligibleBySlot,
                            focusStats,
                            setTargets,
                          )}
                          columnRowsByKey={columnRowsByKey}
                          onSelectSlotPiece={(slot, instanceId) => {
                            const targetColumn = resolveGroupedSlotSelectionColumn(
                              collapsedGroup,
                              slot,
                              instanceId,
                              patternEligibleBySlot,
                            );
                            persistPatternSlotRepresentative(
                              targetColumn.columnKey,
                              targetColumn.patternKey,
                              slot,
                              instanceId,
                            );
                          }}
                          onToggleKeep={toggleKeep}
                          onToggleFavorite={toggleFavorite}
                          onToggleJunk={toggleJunk}
                          setTargets={setTargets}
                          globalGoldPlacements={globalGoldPlacements}
                          setHash={setRow.setHash}
                          setName={setRow.setName}
                        />
                      )
                    : setRow.columns.map((column) => (
                        <RollPatternColumn
                          key={column.columnKey}
                          columnKey={column.columnKey}
                          pattern={column.pattern}
                          focusStats={focusStats}
                          items={classState.items}
                          rows={columnRowsByKey[column.columnKey] ?? []}
                          eligibleBySlot={patternEligibleBySlot[column.columnKey] ?? {}}
                          onSelectSlotPiece={(slot, instanceId) =>
                            persistPatternSlotRepresentative(
                              column.columnKey,
                              column.patternKey,
                              slot,
                              instanceId,
                            )
                          }
                          onToggleKeep={toggleKeep}
                          onToggleFavorite={toggleFavorite}
                          onToggleJunk={toggleJunk}
                          setTargets={setTargets}
                          globalGoldPlacements={globalGoldPlacements}
                          setHash={column.setHash}
                          setName={column.setName}
                          splitRollChips={shouldSplitRollChipsInSetRow(setRow.columns)}
                        />
                      ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowDetails((open) => !open)}
        className="mt-2 cursor-pointer text-xs text-accent-dim hover:text-white underline-offset-2 hover:underline"
        aria-expanded={showDetails}
      >
        {showDetails ? t('coverage.hideRollDetails') : t('coverage.showRollDetails')}
      </button>

      {showDetails && (
        <BuildCoverageDetails analysis={activeAnalysis} targetCount={build.statTargets.length} />
      )}
    </section>
  );
}

function BuildCoverageDetails({
  analysis,
  targetCount,
}: {
  analysis: CoverageAnalysis;
  targetCount: number;
}) {
  const { t } = useTranslation('build');
  return (
    <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
      <div className="text-xs text-muted space-y-1">
        <p>{t('coverage.detailsSupporting', { count: analysis.supportingPieces })}</p>
        <p>
          {t('coverage.detailsProfiles', {
            filled: analysis.filledProfiles,
            possible: analysis.possibleProfiles,
          })}
        </p>
      </div>

      {analysis.redundantOverlap && (
        <p className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-muted ring-1 ring-white/10">
          {t('coverage.detailsRedundantOverlap')}
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-xs font-semibold text-white/90 mb-1">{t('coverage.gapsHeading')}</h3>
          <p className="text-[11px] text-muted mb-2">{t('coverage.gapsIntro')}</p>
          {analysis.gaps.length === 0 ? (
            <p className="text-xs text-muted">{t('coverage.gapsEmpty')}</p>
          ) : (
            <ul className="space-y-1.5">
              {analysis.gaps.map((gap) => (
                <li
                  key={`${gap.key.archetype}-${gap.key.armorSlot}-${gap.key.tertiaryStat}`}
                  className="rounded-md bg-white/[0.03] px-2.5 py-1.5 text-xs text-white/90 ring-1 ring-white/10"
                >
                  {gap.label}
                  <span className="text-muted ml-1">
                    ({coverageGapDetailCopy(gap.buildStatHits, targetCount)})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-xs font-semibold text-white/90 mb-1">Roll types you have many of</h3>
          <p className="text-[11px] text-muted mb-2">
            Three or more pieces in the same combination.
          </p>
          {analysis.overlaps.length === 0 ? (
            <p className="text-xs text-muted">No heavy duplicates in one roll type.</p>
          ) : (
            <ul className="space-y-1.5">
              {analysis.overlaps.map((cluster) => (
                <li
                  key={`${cluster.key.archetype}-${cluster.key.armorSlot}-${cluster.key.tertiaryStat}`}
                  className="flex items-center justify-between gap-2 rounded-md bg-white/[0.03] px-2.5 py-1.5 text-xs ring-1 ring-white/10"
                >
                  <span className="text-white/90 truncate">{cluster.label}</span>
                  <span className="shrink-0 text-muted tabular-nums">
                    {t('coverage.overlapCount', { count: cluster.count })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
