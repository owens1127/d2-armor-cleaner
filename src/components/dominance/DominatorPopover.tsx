import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { ArmorPiece, ClassPreferenceProfile, Stat } from '@/types';
import { StatIcon } from '@/components/StatIcon';
import { ArmorCard, statCompareMap } from '@/components/duel/ArmorCard';
import { STAT_LABELS } from '@/lib/constants';
import {
  comparableStatDeltas,
  formatBeatsOn,
  hasDifferentStatSplit,
  type DominatorResult,
} from '@/lib/scoring/dominance';
import { scoreItem } from '@/lib/scoring/score';

export type DominatorPopoverReason = 'stat-lower' | 'tuning-equivalent';

/** Show on pointerenter; hide after a short grace when leaving the hover zone. */
export const SHOW_DELAY_MS = 0;
export const HIDE_DELAY_MS = 100;
const SIDE_GAP = 12;
/** Rough size for first-frame placement before the portaled panel is measured. */
const EST_POPOVER_WIDTH = 352;
const EST_POPOVER_HEIGHT = 420;
const VIEWPORT_PAD = 16;
/** Extra tolerance so diagonal moves into the portaled popover still count as "inside". */
const BRIDGE_OVERSHOOT = 4;

export type PopoverPlacement = 'below' | 'above';

export interface PopoverPosition {
  x: number;
  y: number;
  placement: PopoverPlacement;
}

/** @deprecated Use PopoverPosition */
export type SidePosition = PopoverPosition;

export interface BridgeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface DominatorPopoverProps {
  candidate: ArmorPiece;
  result: DominatorResult;
  classPrefs: ClassPreferenceProfile;
  classItems: ArmorPiece[];
  /** Why this piece is redundant: affects header and beat copy. */
  reason?: DominatorPopoverReason;
  /** When reason is tuning-equivalent, true if both pieces reach the same tuning layouts. */
  tuningMutual?: boolean;
  children: ReactNode;
}

function viewportSize() {
  if (typeof window !== 'undefined') {
    return { vw: window.innerWidth, vh: window.innerHeight };
  }
  return { vw: 1200, vh: 800 };
}

function statDeltaPillClass(delta: number): string {
  if (delta > 0) return 'bg-emerald-500/20 text-emerald-100';
  if (delta < 0) return 'bg-red-500/20 text-red-100';
  return 'bg-white/5 text-white/45';
}

function formatStatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `${delta}`;
  return '=';
}

function StatDeltaRow({ beats }: { beats: DominatorResult['beatsOn'] }) {
  if (beats.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      {beats.map(({ stat, delta }) => (
        <span
          key={stat}
          className={`inline-flex items-center gap-1.5 text-sm px-2 py-1 rounded-md ${statDeltaPillClass(delta)}`}
        >
          <StatIcon stat={stat} size="sm" variant="glyph" />
          <span>{STAT_LABELS[stat]}</span>
          <span className="tabular-nums font-medium">{formatStatDelta(delta)}</span>
        </span>
      ))}
    </div>
  );
}

function isComparableDominatorPair(candidate: ArmorPiece, result: DominatorResult): boolean {
  return result.dominator.tertiaryStat === candidate.tertiaryStat;
}

function popoverHeader(reason: DominatorPopoverReason, statSplit: boolean): string {
  if (statSplit) return 'Different stat split';
  return reason === 'tuning-equivalent' ? 'Same after tuning' : 'Beats this piece';
}

export interface ComparisonCaption {
  label: string;
  footnote?: string;
}

export function comparisonCaption(
  reason: DominatorPopoverReason,
  tuningMutual: boolean,
  statSplit: boolean,
): ComparisonCaption {
  void statSplit;
  if (statSplit) {
    return { label: 'Stat comparison' };
  }
  if (reason === 'tuning-equivalent') {
    return { label: tuningMutual ? 'Tuning coverage' : 'Ahead on' };
  }
  return { label: 'Stat comparison' };
}

export function DominatorPopoverContent({
  candidate,
  result,
  classPrefs,
  classItems,
  reason = 'stat-lower',
  tuningMutual = false,
}: Omit<DominatorPopoverProps, 'children'>) {
  if (!isComparableDominatorPair(candidate, result)) return null;

  const { dominator } = result;
  const statDeltas = comparableStatDeltas(dominator, candidate);
  const dominatorBreakdown = scoreItem(dominator, classPrefs, classItems);
  const statCompare = statCompareMap(dominator, candidate);
  const statSplit = hasDifferentStatSplit(statDeltas);
  const caption = comparisonCaption(reason, tuningMutual, statSplit);
  const beatsText =
    reason === 'tuning-equivalent' && tuningMutual && statDeltas.every((b) => b.delta === 0)
      ? 'every tuning layout'
      : formatBeatsOn(statDeltas);
  const showSummaryLine =
    statDeltas.length === 0 ||
    (reason === 'tuning-equivalent' && tuningMutual) ||
    statSplit;

  return (
    <div className="w-[min(22rem,calc(100vw-2rem))] text-sm text-white/90">
      <p className="text-sm font-semibold text-white mb-3">{popoverHeader(reason, statSplit)}</p>
      <ArmorCard
        piece={dominator}
        breakdown={dominatorBreakdown}
        variant="browse"
        static
        className="!border-0 !bg-transparent !p-0 !shadow-none hover:!border-transparent pointer-events-none"
        statCompare={Object.fromEntries(
          Object.entries(statCompare).map(([k, v]) => [
            k,
            v === 'win' ? 'win' : v === 'lose' ? 'lose' : 'tie',
          ]),
        ) as Partial<Record<Stat, 'win' | 'lose' | 'tie'>>}
      />
      {statDeltas.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-white/55 mb-1.5">{caption.label}</p>
          <StatDeltaRow beats={statDeltas} />
        </div>
      )}
      {showSummaryLine && (
        <p className="mt-2 text-sm leading-snug text-white/70">{beatsText}</p>
      )}
    </div>
  );
}

/**
 * Places the popover below the anchor card (preferred) or above when there is
 * insufficient room below. Horizontally aligned with the card left edge, clamped
 * so the full panel stays inside the viewport.
 */
export function computePopoverPosition(
  anchor: DOMRect,
  popW: number,
  popH: number,
): PopoverPosition {
  const { vw, vh } = viewportSize();

  let x = anchor.left;
  x = Math.max(VIEWPORT_PAD, Math.min(x, vw - VIEWPORT_PAD - popW));

  const belowY = anchor.bottom + SIDE_GAP;
  const aboveY = anchor.top - SIDE_GAP - popH;

  const fitsBelow = belowY + popH <= vh - VIEWPORT_PAD;
  const fitsAbove = aboveY >= VIEWPORT_PAD;

  let y: number;
  let placement: PopoverPlacement;

  if (fitsBelow) {
    y = belowY;
    placement = 'below';
  } else if (fitsAbove) {
    y = aboveY;
    placement = 'above';
  } else {
    placement = 'below';
    y = Math.max(VIEWPORT_PAD, Math.min(belowY, vh - VIEWPORT_PAD - popH));
  }

  return { x, y, placement };
}

/** @deprecated Use computePopoverPosition */
export const computeSidePosition = computePopoverPosition;

/** Invisible hit target spanning the gap between trigger card and portaled popover. */
export function computeBridgeRect(
  anchor: DOMRect,
  pos: PopoverPosition,
  popW: number,
  popH: number,
): BridgeRect {
  const popLeft = pos.x;
  const popRight = pos.x + popW;
  const popTop = pos.y;
  const popBottom = pos.y + popH;

  const left = Math.min(anchor.left, popLeft) - BRIDGE_OVERSHOOT;
  const right = Math.max(anchor.right, popRight) + BRIDGE_OVERSHOOT;

  if (pos.placement === 'below') {
    return {
      left,
      top: anchor.bottom,
      width: right - left,
      height: Math.max(SIDE_GAP + BRIDGE_OVERSHOOT, popTop - anchor.bottom),
    };
  }

  return {
    left,
    top: popBottom,
    width: right - left,
    height: Math.max(SIDE_GAP + BRIDGE_OVERSHOOT, anchor.top - popBottom),
  };
}

function isHoverTarget(node: EventTarget | null, ...refs: Array<{ current: HTMLElement | null }>) {
  if (!(node instanceof Node)) return false;
  return refs.some((ref) => ref.current?.contains(node));
}

function getScrollParent(el: HTMLElement): HTMLElement | null {
  let parent = el.parentElement;
  while (parent) {
    const { overflowY, overflowX } = getComputedStyle(parent);
    if (
      /auto|scroll|overlay/.test(overflowY) ||
      /auto|scroll|overlay/.test(overflowX)
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

export function DominatorPopover({
  candidate,
  result,
  classPrefs,
  classItems,
  reason = 'stat-lower',
  tuningMutual = false,
  children,
}: DominatorPopoverProps) {
  if (!isComparableDominatorPair(candidate, result)) {
    return <>{children}</>;
  }

  const popoverId = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [positioned, setPositioned] = useState(false);
  const [pos, setPos] = useState<PopoverPosition>({ x: 0, y: 0, placement: 'below' });
  const [bridge, setBridge] = useState<BridgeRect | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current !== undefined) {
      clearTimeout(hideTimer.current);
      hideTimer.current = undefined;
    }
  }, []);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current?.getBoundingClientRect();
    const pop = popoverRef.current;
    if (!anchor || !pop) return;
    const popW = pop.offsetWidth;
    const popH = pop.offsetHeight;
    const next = computePopoverPosition(anchor, popW, popH);
    setPos(next);
    setBridge(computeBridgeRect(anchor, next, popW, popH));
    setPositioned(true);
  }, []);

  const seedPosition = useCallback(() => {
    const anchor = anchorRef.current?.getBoundingClientRect();
    if (!anchor) return;
    const next = computePopoverPosition(anchor, EST_POPOVER_WIDTH, EST_POPOVER_HEIGHT);
    setPos(next);
    setBridge(computeBridgeRect(anchor, next, EST_POPOVER_WIDTH, EST_POPOVER_HEIGHT));
    setPositioned(true);
  }, []);

  const enterHoverZone = useCallback(() => {
    clearHideTimer();
    seedPosition();
    setOpen(true);
  }, [clearHideTimer, seedPosition]);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimer.current = setTimeout(() => {
      setOpen(false);
      setPositioned(false);
      setBridge(null);
    }, HIDE_DELAY_MS);
  }, [clearHideTimer]);

  const leaveHoverZone = useCallback(
    (event: ReactPointerEvent) => {
      if (isHoverTarget(event.relatedTarget, anchorRef, popoverRef, bridgeRef)) return;
      scheduleHide();
    },
    [scheduleHide],
  );

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const onReposition = () => {
      if (raf !== 0) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        updatePosition();
      });
    };
    window.addEventListener('resize', onReposition, { passive: true });
    const scrollEl =
      (anchorRef.current && getScrollParent(anchorRef.current)) ?? document.documentElement;
    scrollEl.addEventListener('scroll', onReposition, { passive: true });
    return () => {
      if (raf !== 0) cancelAnimationFrame(raf);
      window.removeEventListener('resize', onReposition);
      scrollEl.removeEventListener('scroll', onReposition);
    };
  }, [open, updatePosition]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  return (
    <>
      <div
        ref={anchorRef}
        className="relative flex flex-col flex-1 h-full w-full min-h-0 rounded-xl transition-[box-shadow] duration-150 hover:ring-1 hover:ring-white/15"
        onPointerEnter={enterHoverZone}
        onPointerLeave={leaveHoverZone}
      >
        {children}
      </div>
      {open &&
        createPortal(
          <>
            {bridge && (
              <div
                ref={bridgeRef}
                aria-hidden
                className="fixed z-[299] pointer-events-auto"
                style={{
                  left: bridge.left,
                  top: bridge.top,
                  width: bridge.width,
                  height: bridge.height,
                }}
                onPointerEnter={enterHoverZone}
                onPointerLeave={leaveHoverZone}
              />
            )}
            <div
              ref={popoverRef}
              id={popoverId}
              role="tooltip"
              className="fixed z-[300] rounded-xl border border-white/15 bg-surface-2 shadow-2xl shadow-black/60 p-4 pointer-events-auto"
              style={{
                left: pos.x,
                top: pos.y,
                visibility: positioned ? 'visible' : 'hidden',
              }}
              onPointerEnter={enterHoverZone}
              onPointerLeave={leaveHoverZone}
            >
              <DominatorPopoverContent
                candidate={candidate}
                result={result}
                classPrefs={classPrefs}
                classItems={classItems}
                reason={reason}
                tuningMutual={tuningMutual}
              />
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
