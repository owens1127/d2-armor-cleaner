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
import { Link, useSearchParams } from 'react-router-dom';
import { useVaultInteractionHold } from '@/hooks/useVaultRefreshGuard';
import { BUILD_QUERY_PARAM, desiredBuildsEditorPath, resolveCombosBuildId } from '@/lib/nav';
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
import { CopyDimQueryButton } from '@/components/items/CopyDimQueryButton';
import {
  LOADOUT_ACTION_COL_W,
  LOADOUT_CHOOSE_BTN_H,
  LOADOUT_SLOT_MAIN_H,
  rollPatternColumnsGridClass,
  rollPatternLoadoutColumnSubgridStyle,
  rollPatternLoadoutSetRowStyle,
  shouldSplitRollChipsInSetRow,
} from '@/components/dashboard/buildCoverageLayout';
import { formatArmorTierBadge, hasDisplayTier } from '@/lib/armor/tier';
import { SLOT_LABELS, STAT_LABELS } from '@/lib/constants';
import { armorHasDimFavorite } from '@/lib/dim/parseTags';
import {
  DIM_TAG_DEFINITIONS,
  tagActionFavoriteActive,
  tagActionIconBtnClass,
  tagActionJunkActive,
  tagActionKeepActive,
  TAG_ACTION_GLYPH_PX,
  type TagActionKind,
} from '@/lib/dim/tagConfig';
import {
  analyzeCoverage,
  formatSetBonusProgressLabel,
  formatSetBonusVaultReachLabel,
  deriveOptimalRollPatterns,
  formatEmptyPatternSlotMessage,
  archetypeIrrelevantSecondary,
  archetypePriorityIntrinsics,
  formatArchetypeGroupLabel,
  normalizeDesiredBuilds,
  OPTIMAL_ROLL_TERTIARY_BONUS,
  OPTIMAL_ROLL_TUNING_BONUS,
  rollPatternStatBonuses,
  orderEligiblePiecesForSlotPicker,
  resolveEffectiveRollPatternSlotRepresentatives,
  type OptimalRollPattern,
  type PatternLoadoutSource,
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
  countUniqueSetPiecesInPatternGrid,
  type PatternColumnSlotRow,
} from '@/lib/coverage/patternLoadoutGrid';
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

/** Picker overlay: fixed columns so tag actions and status badge stay aligned row-to-row. */
const PICKER_TAG_COL_W = 'w-[9.5rem]';
const PICKER_STATUS_COL_W = 'w-[4.5rem]';

function TagActionGlyph({ tag, px = TAG_ACTION_GLYPH_PX }: { tag: TagActionKind; px?: number }) {
  const def = DIM_TAG_DEFINITIONS[tag];
  return (
    <svg width={px} height={px} viewBox="0 0 512 512" aria-hidden className="block shrink-0">
      <path fill="currentColor" d={def.svgPath} />
    </svg>
  );
}

function TagActionButton({
  tag,
  active,
  locked,
  disabled,
  title,
  onClick,
}: {
  tag: TagActionKind;
  active: boolean;
  /** Applied in DIM but not removable from this control (favorite). */
  locked?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={locked || disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={tagActionIconBtnClass(tag, active, { locked })}
    >
      <TagActionGlyph tag={tag} />
    </button>
  );
}

function browseBuildHref(classType: ClassType, buildId: string): string {
  return `/browse/${classType}?build=${encodeURIComponent(buildId)}`;
}

const patternChipBaseClass =
  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] leading-none';

function PatternRollSeparator() {
  return (
    <span className="text-white/30 text-[10px] select-none shrink-0" aria-hidden>
      ·
    </span>
  );
}

function PatternPriorityStatChip({ stat, bonus }: { stat: Stat; bonus: number }) {
  return (
    <span
      title={`${STAT_LABELS[stat]} from archetype (+${bonus})`}
      className={`${patternChipBaseClass} border-white/25 bg-white/8 text-white`}
    >
      <StatIcon stat={stat} size="sm" variant="glyph" />
      <span>{STAT_LABELS[stat]}</span>
    </span>
  );
}

function PatternIrrelevantSecondaryChip({ stat }: { stat: Stat }) {
  return (
    <span
      title={`${STAT_LABELS[stat]} — not a combo priority`}
      className={`${patternChipBaseClass} border-white/8 bg-transparent text-white/35 text-[9px]`}
    >
      <StatIcon stat={stat} size="sm" variant="glyph" className="opacity-60" />
      <span>{STAT_LABELS[stat]}</span>
    </span>
  );
}

function rollStatRoleTitle(stat: Stat, role: RollStatRole): string {
  if (role === 'combined') {
    return `${STAT_LABELS[stat]} tertiary + tuning (+${OPTIMAL_ROLL_TERTIARY_BONUS} +${OPTIMAL_ROLL_TUNING_BONUS})`;
  }
  if (role === 'tertiary') {
    return `${STAT_LABELS[stat]} tertiary (+${OPTIMAL_ROLL_TERTIARY_BONUS})`;
  }
  return `${STAT_LABELS[stat]} tuning (+${OPTIMAL_ROLL_TUNING_BONUS})`;
}

function rollStatRoleLabel(role: Exclude<RollStatRole, never>): string {
  if (role === 'combined') return 'tertiary + tuning';
  if (role === 'tertiary') return 'tertiary';
  return 'tuning';
}

function PatternRollRoleChip({ stat, role }: { stat: Stat; role: RollStatRole }) {
  return (
    <span
      title={rollStatRoleTitle(stat, role)}
      className={`${patternChipBaseClass} border-white/15 bg-white/5 text-white/90`}
    >
      <StatIcon stat={stat} size="sm" variant="glyph" />
      <span>{STAT_LABELS[stat]}</span>
      <span className="text-white/45">{rollStatRoleLabel(role)}</span>
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

function PatternRollRoleChips({
  tertiaryStat,
  tuningStat,
  splitRollChips = false,
}: {
  tertiaryStat: Stat;
  tuningStat: Stat;
  splitRollChips?: boolean;
}) {
  return (
    <>
      {rollPatternStatBonuses(tertiaryStat, tuningStat, { forceSplit: splitRollChips }).map(
        ({ stat, role }) => (
          <PatternRollRoleChip key={`${stat}-${role}`} stat={stat} role={role} />
        ),
      )}
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
  const title =
    pattern.archetype !== null
      ? formatArchetypeGroupLabel(pattern.archetype, priorities)
      : 'Any archetype';

  const showArchetypeChips =
    pattern.archetype !== null &&
    (archetypePriorityIntrinsics(pattern.archetype, priorities).length > 0 ||
      archetypeIrrelevantSecondary(pattern.archetype, priorities) !== null);

  const showChipRow =
    showArchetypeChips ||
    rollPatternStatBonuses(pattern.tertiaryStat, pattern.tuningStat, {
      forceSplit: splitRollChips,
    }).length > 0;

  return (
    <div
      className="flex min-w-0 flex-col gap-1"
      aria-label={`${title}${setName ? ` · ${setName}` : ''}`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className="text-[11px] font-semibold leading-snug text-white">{title}</span>
        {slotsFilled !== undefined && (
          <span className="shrink-0 text-[10px] tabular-nums text-muted">{slotsFilled}/5</span>
        )}
        {setName && (
          <span className="inline-flex min-w-0 items-center gap-1 text-[10px] font-medium leading-snug text-accent-dim">
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

function ChevronIcon({ open, className = '' }: { open: boolean; className?: string }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 12 12"
      aria-hidden
      className={`block shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${className}`}
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

function SelectedCheckIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 12 12" aria-hidden className="block shrink-0 text-white/70">
      <path
        d="M2.5 6.25 4.75 8.5 9.5 3.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

const PICKER_MENU_MIN_WIDTH = 260;
const PICKER_MENU_MAX_HEIGHT = 280;

function computePickerMenuPosition(anchor: DOMRect, popW: number, popH: number) {
  const base = computePopoverPosition(anchor, popW, popH);
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  let x = anchor.right - popW;
  x = Math.max(8, Math.min(x, vw - 8 - popW));
  return { ...base, x };
}

function PiecePickerMetaLine({
  piece,
  isSetTarget = false,
}: {
  piece: ArmorPiece;
  isSetTarget?: boolean;
}) {
  const setName = piece.armorSet?.name;
  const tierLabel = hasDisplayTier(piece.tier) ? formatArmorTierBadge(piece.tier) : null;

  if (!tierLabel && !setName) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0 text-[10px] text-white/45 mt-0.5 min-w-0">
      {tierLabel && (
        <span className="tabular-nums text-white/55 shrink-0" title={`Tier ${piece.tier}`}>
          {tierLabel}
        </span>
      )}
      {setName && (
        <span
          className={`inline-flex items-center gap-1 truncate min-w-0 ${isSetTarget ? 'text-accent-dim font-medium' : ''}`}
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

function SlotPiecePickerMenu({
  open,
  anchorRef,
  slot,
  eligiblePieces,
  selectedInstanceId,
  onSelectPiece,
  onToggleKeep,
  onToggleFavorite,
  onToggleJunk,
  onClose,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  slot: ArmorSlot;
  eligiblePieces: EligibleLoadoutPiece[];
  selectedInstanceId: string;
  onSelectPiece: (instanceId: string) => void;
  onToggleKeep: (piece: ArmorPiece) => void;
  onToggleFavorite: (piece: ArmorPiece) => void;
  onToggleJunk: (piece: ArmorPiece) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const displayPieces = orderEligiblePiecesForSlotPicker(
    eligiblePieces,
    selectedInstanceId,
  );
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current?.getBoundingClientRect();
    const menu = menuRef.current;
    if (!anchor || !menu) return;
    const next = computePickerMenuPosition(
      anchor,
      menu.offsetWidth || PICKER_MENU_MIN_WIDTH,
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
    <div
      ref={menuRef}
      id={listId}
      role="listbox"
      aria-label={`Choose ${SLOT_LABELS[slot]}`}
      className="fixed z-[300] rounded-md border border-border bg-surface-2 shadow-lg shadow-black/50 overflow-hidden flex flex-col min-h-0"
      onMouseDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      style={{
        left: pos.x,
        top: pos.y,
        minWidth: PICKER_MENU_MIN_WIDTH,
        maxWidth: 'min(320px, calc(100vw - 16px))',
        maxHeight: PICKER_MENU_MAX_HEIGHT,
      }}
    >
      <div className="px-2.5 py-1.5 border-b border-border/60 bg-black/20 shrink-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-white/45">
          {SLOT_LABELS[slot]}
        </p>
        <p className="text-[11px] text-white/70 tabular-nums">
          {eligiblePieces.length} eligible {eligiblePieces.length === 1 ? 'piece' : 'pieces'}
        </p>
        <p className="text-[10px] text-white/45 mt-0.5">
          Sorted by combo fit, then preference and tier
        </p>
      </div>
      <ul className="overflow-y-auto flex-1 min-h-0 py-0.5">
        {displayPieces.map(({ piece: altPiece }) => {
          const selected = altPiece.instanceId === selectedInstanceId;
          const isTaggedKeep = tagActionKeepActive(altPiece);
          const isTaggedJunk = tagActionJunkActive(altPiece);
          const dimFavorite = tagActionFavoriteActive(altPiece);
          const selectRow = () => {
            onSelectPiece(altPiece.instanceId);
            onClose();
          };
          const rowClass = `w-full flex items-center gap-2 px-1 py-1 transition-colors border-l-2 cursor-pointer ${
            selected
              ? 'border-l-white/75 bg-white/[0.08]'
              : 'border-l-transparent hover:bg-white/5 hover:border-l-white/25'
          }`;
          return (
            <li
              key={altPiece.instanceId}
              role="option"
              aria-selected={selected}
              className={rowClass}
              onClick={selectRow}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  selectRow();
                }
              }}
            >
              <div className="flex-1 min-w-0 flex items-center gap-2 pl-1 pr-0.5 py-0.5 text-left">
                <ItemIcon
                  piece={altPiece}
                  size="sm"
                  buildOptimal={false}
                />
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-[11px] leading-snug line-clamp-2 block ${
                      selected ? 'text-white font-medium' : 'text-white/90'
                    }`}
                    title={altPiece.name}
                  >
                    {altPiece.name}
                  </span>
                  <PiecePickerMetaLine piece={altPiece} />
                </div>
              </div>
              <div
                className={`flex shrink-0 items-center justify-end gap-0.5 ${PICKER_TAG_COL_W}`}
                onClick={(event) => event.stopPropagation()}
              >
                <CopyDimQueryButton
                  instanceId={altPiece.instanceId}
                  itemName={altPiece.name}
                />
                <TagActionButton
                  tag="keep"
                  active={isTaggedKeep}
                  title={isTaggedKeep ? 'Remove keep tag in DIM' : 'Tag keep in DIM'}
                  onClick={() => onToggleKeep(altPiece)}
                />
                <TagActionButton
                  tag="favorite"
                  active={dimFavorite}
                  locked={dimFavorite}
                  title={
                    dimFavorite ? 'Already favorited in DIM' : 'Tag favorite in DIM'
                  }
                  onClick={() => onToggleFavorite(altPiece)}
                />
                <TagActionButton
                  tag="junk"
                  active={isTaggedJunk}
                  title={isTaggedJunk ? 'Remove junk tag in DIM' : 'Tag junk in DIM'}
                  onClick={() => onToggleJunk(altPiece)}
                />
              </div>
              <span
                className={`shrink-0 flex items-center justify-end text-[10px] pr-1.5 ${PICKER_STATUS_COL_W}`}
              >
                {selected && (
                  <span className="inline-flex items-center gap-0.5 text-white/80">
                    <SelectedCheckIcon />
                    Selected
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>,
    document.body,
  );
}

function SlotColumn({ slot }: { slot: ArmorPiece['armorSlot'] }) {
  const slotLabel = SLOT_LABELS[slot];
  return (
    <div
      className="flex items-center justify-center w-8 shrink-0 self-center"
      title={slotLabel}
    >
      <SlotIcon slot={slot} size="sm" />
    </div>
  );
}

function NearMatchTuneIndicator({ title }: { title?: string }) {
  if (!title) return null;
  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-white/55"
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

function PatternSlotRow({
  slotEntry,
  pattern,
  priorities,
  setName,
  eligiblePieces,
  displayPiece,
  matchTier,
  selectionSource,
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
}: {
  slotEntry: PatternSlotLoadoutEntry;
  pattern: OptimalRollPattern;
  priorities: Stat[];
  setName?: string;
  eligiblePieces: EligibleLoadoutPiece[];
  displayPiece: ArmorPiece | null;
  matchTier: 'perfect' | 'near' | null;
  selectionSource: PatternLoadoutSource;
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
}) {
  const { slot } = slotEntry;
  const [pickerOpen, setPickerOpen] = useState(false);
  useVaultInteractionHold(pickerOpen);
  const pickerTriggerRef = useRef<HTMLButtonElement>(null);
  const hasAlternatives = eligiblePieces.length > 1;

  if (!displayPiece) {
    return (
      <div
        className={`flex h-full min-h-0 flex-col border-b border-dashed border-border/35 last:border-b-0 ${LOADOUT_SLOT_MAIN_H}`}
      >
        <div className="flex min-h-0 flex-1 items-center gap-2.5 px-3">
          <SlotColumn slot={slot} />
          <p className="min-w-0 flex-1 text-[11px] leading-snug text-muted/90">
            {formatEmptyPatternSlotMessage(slot, pattern, { priorities, setName })}
          </p>
          <div className={`shrink-0 ${LOADOUT_ACTION_COL_W}`} aria-hidden />
        </div>
      </div>
    );
  }

  const piece = displayPiece;
  const isNearMatch = matchTier === 'near';
  const isTaggedKeep = tagActionKeepActive(piece);
  const isTaggedJunk = tagActionJunkActive(piece);
  const dimFavorite = tagActionFavoriteActive(piece);
  const userPick = selectionSource === 'representative';

  const rowSurfaceClass = isNearMatch
    ? 'bg-white/[0.02]'
    : pieceIsSetTarget
      ? userPick
        ? 'bg-accent-dim/12'
        : 'bg-accent-dim/8'
      : userPick
        ? 'bg-white/10'
        : 'bg-white/[0.05]';

  const rowTooltip =
    isNearMatch && nearMatchTitle
      ? `${piece.name} — ${nearMatchTitle}`
      : piece.name;

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden border-b border-white/10 last:border-b-0 ${LOADOUT_SLOT_MAIN_H}`}
    >
      <div
        className={`flex min-h-0 flex-1 items-center gap-2 px-3 transition-colors ${rowSurfaceClass}`}
        title={isNearMatch ? rowTooltip : undefined}
      >
        <SlotColumn slot={slot} />
        <div className={isNearMatch ? 'shrink-0 opacity-45' : 'shrink-0'}>
          <ItemIcon
            piece={piece}
            size="sm"
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

        {isNearMatch ? (
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden" title={rowTooltip}>
            <span className="min-w-0 flex-1 truncate text-[11px] font-medium leading-none text-white/92">
              {piece.name}
            </span>
            <NearMatchTuneIndicator title={nearMatchTitle} />
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col justify-center overflow-hidden">
            <span
              className="line-clamp-2 min-w-0 text-[11px] font-medium leading-snug text-white"
              title={piece.name}
            >
              {piece.name}
            </span>
            <PiecePickerMetaLine piece={piece} isSetTarget={pieceIsSetTarget} />
          </div>
        )}

        {isNearMatch ? (
          <div className="flex shrink-0 items-center self-center opacity-55">
            <CopyDimQueryButton instanceId={piece.instanceId} itemName={piece.name} />
          </div>
        ) : (
        <div
          className={`flex min-h-0 shrink-0 flex-col items-end justify-between self-stretch py-1 ${LOADOUT_ACTION_COL_W}`}
        >
          <div className="flex items-center gap-0.5">
            <CopyDimQueryButton instanceId={piece.instanceId} itemName={piece.name} />
            <TagActionButton
              tag="keep"
              active={isTaggedKeep}
              title={isTaggedKeep ? 'Remove keep tag in DIM' : 'Tag keep in DIM'}
              onClick={() => onToggleKeep(piece)}
            />
            <TagActionButton
              tag="favorite"
              active={dimFavorite}
              locked={dimFavorite}
              title={dimFavorite ? 'Already favorited in DIM' : 'Tag favorite in DIM'}
              onClick={() => onToggleFavorite(piece)}
            />
            <TagActionButton
              tag="junk"
              active={isTaggedJunk}
              title={isTaggedJunk ? 'Remove junk tag in DIM' : 'Tag junk in DIM'}
              onClick={() => onToggleJunk(piece)}
            />
          </div>
          {hasAlternatives ? (
            <button
              ref={pickerTriggerRef}
              type="button"
              onClick={() => setPickerOpen((open) => !open)}
              aria-haspopup="listbox"
              aria-expanded={pickerOpen}
              aria-label={`Choose piece — ${eligiblePieces.length} eligible`}
              title={`${eligiblePieces.length} eligible pieces in vault`}
              className={`inline-flex cursor-pointer ${LOADOUT_CHOOSE_BTN_H} items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors ${
                pickerOpen
                  ? 'bg-white/18 text-white ring-1 ring-white/25'
                  : userPick
                    ? 'bg-white/12 text-white hover:bg-white/18'
                    : 'bg-white/[0.05] text-white/85 hover:bg-white/12 hover:text-white'
              }`}
            >
              <span>Choose</span>
              <span className="tabular-nums text-white/50">{eligiblePieces.length}</span>
              <ChevronIcon open={pickerOpen} className="text-white/65" />
            </button>
          ) : (
            <span className={`shrink-0 ${LOADOUT_CHOOSE_BTN_H}`} aria-hidden />
          )}
        </div>
        )}
      </div>

      {hasAlternatives && (
        <SlotPiecePickerMenu
          open={pickerOpen}
          anchorRef={pickerTriggerRef}
          slot={slot}
          eligiblePieces={eligiblePieces}
          selectedInstanceId={piece.instanceId}
          onSelectPiece={onSelectPiece}
          onToggleKeep={onToggleKeep}
          onToggleFavorite={onToggleFavorite}
          onToggleJunk={onToggleJunk}
          onClose={() => setPickerOpen(false)}
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
      className={`grid min-w-0 overflow-hidden rounded-xl bg-surface/50 ring-1 ${hasAnyPiece ? 'ring-white/10' : 'ring-white/7'} backdrop-blur-sm`}
      style={rollPatternLoadoutColumnSubgridStyle()}
    >
      <div className="flex h-full min-h-0 flex-col border-b border-white/10 px-3 py-2.5">
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
            selectionSource={row.selectionSource}
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

function gapDetail(buildStatHits: number, targetCount: number): string {
  if (buildStatHits >= targetCount) return 'matches all priorities';
  if (buildStatHits >= 2) return 'matches multiple priorities';
  return 'matches one priority';
}

export function BuildCoveragePanel({
  classState,
  classType,
  prefs,
}: BuildCoveragePanelProps) {
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
  const enabledBuilds = useMemo(
    () => normalizeDesiredBuilds(prefs.desiredBuilds, classType).filter((b) => b.enabled !== false),
    [prefs.desiredBuilds, classType],
  );
  const activeBuildId = useMemo(
    () => resolveCombosBuildId(searchParams.get(BUILD_QUERY_PARAM), enabledBuilds, classType),
    [searchParams, enabledBuilds, classType],
  );
  const [showDetails, setShowDetails] = useState(false);

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
        label: 'Combo',
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

  if (!hasSavedBuilds) {
    return (
      <section className="mb-10 rounded-2xl bg-surface/60 px-5 py-4 ring-1 ring-white/8">
        <h2 className="text-base font-semibold tracking-tight text-white">Your combos</h2>
        <p className="mt-1 max-w-xl text-sm text-muted/90">
          Can your vault support tuned armor for your priority stats?
        </p>
        <div className="mt-4 rounded-xl bg-black/15 px-4 py-4 ring-1 ring-white/10">
          <p className="text-sm font-medium text-white">No combos yet</p>
          <p className="mt-2 max-w-lg text-sm text-muted">
            Add 2–4 stats in priority order below. We pick the best piece per optimal roll pattern
            from your vault for archetype and tuning alignment.
          </p>
          <Link
            to={desiredBuildsEditorPath(classType)}
            className="inline-block mt-4 cursor-pointer text-sm text-accent-dim hover:text-white underline-offset-2 hover:underline"
          >
            Add combo
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-10 rounded-2xl bg-surface/60 px-5 py-4 ring-1 ring-white/8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-white">Your combos</h2>
          <p className="mt-1 max-w-xl text-xs text-muted">
            Best piece per slot for each optimal roll pattern (archetype + tertiary + tuning)
          </p>
        </div>
        <Link
          to={desiredBuildsEditorPath(classType)}
          className="cursor-pointer text-[11px] text-white/70 hover:text-white shrink-0 underline-offset-2 hover:underline"
        >
          Edit combos
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {allAnalyses.map((analysis) => {
          const id = analysis.build.desiredBuildId ?? analysis.build.id;
          const active = id === buildId;
          return (
            <button
              key={id}
              type="button"
              onClick={() => selectBuild(id)}
              className={`cursor-pointer text-left rounded-lg px-3 py-2 transition-colors ring-1 ${
                active
                  ? 'bg-white/12 ring-white/25'
                  : 'bg-white/[0.03] ring-white/10 hover:bg-white/[0.06] hover:ring-white/18'
              }`}
            >
              <span className="block max-w-[10rem] truncate text-[11px] font-medium text-white">
                {analysis.build.label}
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
          <p className="text-sm font-medium text-white">Set stat priorities on a combo to see roll targets</p>
        </div>
      )}

      <div className="mb-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white/95">Recommended pieces</h3>
          <Link
            to={browseBuildHref(classType, buildId)}
            className="cursor-pointer text-[11px] text-white/70 hover:text-white underline-offset-2 hover:underline shrink-0"
          >
            Browse vault
          </Link>
        </div>
        {(build.setBonus2pc !== undefined || build.setBonus4pc !== undefined) && (
          <div className="space-y-1 rounded-lg bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/10">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] text-muted">
                Set target:{' '}
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
                    {formatSetBonusVaultReachLabel(entry)} — not enough vault pieces
                  </p>
                ))}
            {activeAnalysis.setBonusReadiness.conflictingSets && (
              <p className="text-[11px] text-danger/90">
                These set targets need more than five armor pieces — adjust your combo.
              </p>
            )}
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-4">
          {loadoutSetRows.map((setRow) => (
            <div
              key={setRow.setKey}
              className={`grid min-w-0 items-stretch gap-3.5 ${rollPatternColumnsGridClass()}`}
              style={rollPatternLoadoutSetRowStyle(setRow.columns.length)}
            >
              {setRow.columns.map((column) => (
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
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowDetails((open) => !open)}
        className="mt-2 cursor-pointer text-xs text-accent-dim hover:text-white underline-offset-2 hover:underline"
        aria-expanded={showDetails}
      >
        {showDetails ? 'Hide roll-type details' : 'Show roll-type details'}
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
  return (
    <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
      <div className="text-xs text-muted space-y-1">
        <p>
          <span className="text-white/80 tabular-nums">{analysis.supportingPieces}</span>{' '}
          pieces in your vault roll at least one priority stat.
        </p>
        <p>
          <span className="text-white/80 tabular-nums">{analysis.filledProfiles}</span> of{' '}
          <span className="text-white/80 tabular-nums">{analysis.possibleProfiles}</span>{' '}
          roll types you could own (archetype + tertiary + slot) are in your vault.
        </p>
      </div>

      {analysis.redundantOverlap && (
        <p className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-muted ring-1 ring-white/10">
          You have plenty of pieces for this combo, but some slots are still empty. New drops
          may be duplicates of rolls you already have. Prioritize pieces that fill empty slots.
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-xs font-semibold text-white/90 mb-1">Roll types to hunt</h3>
          <p className="text-[11px] text-muted mb-2">
            Empty combinations that would help this combo.
          </p>
          {analysis.gaps.length === 0 ? (
            <p className="text-xs text-muted">Nothing obvious missing from your matrix.</p>
          ) : (
            <ul className="space-y-1.5">
              {analysis.gaps.map((gap) => (
                <li
                  key={`${gap.key.archetype}-${gap.key.armorSlot}-${gap.key.tertiaryStat}`}
                  className="rounded-md bg-white/[0.03] px-2.5 py-1.5 text-xs text-white/90 ring-1 ring-white/10"
                >
                  {gap.label}
                  <span className="text-muted ml-1">
                    ({gapDetail(gap.buildStatHits, targetCount)})
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
                  <span className="shrink-0 text-muted tabular-nums">{cluster.count} pieces</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
