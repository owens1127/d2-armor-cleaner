import { useRef } from 'react';
import { StatIcon } from '@/components/StatIcon';
import { ARCHETYPE_LABELS, ARCHETYPE_STATS, STAT_LABELS } from '@/lib/constants';
import type { Archetype, Stat } from '@/types';

const SWIPE_THRESHOLD = 50;

interface SwipePickCardProps {
  label: string;
  /** Single stat pick (tertiary/tuning): icon beside label, or highlight in piece context */
  stat?: Stat;
  /** Archetype primary stats: icon + muted label for each */
  stats?: Stat[];
  /** Focus archetype for tertiary/tuning picks: muted fixed primaries + highlighted choice */
  focusArchetype?: Archetype;
  /** Which stat role is highlighted (for screen readers) */
  highlightRole?: 'tertiary' | 'tuning';
  onPick: () => void;
  disabled?: boolean;
  className?: string;
}

function StatLabelsRow({ stats, size }: { stats: Stat[]; size: 'sm' | 'md' }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
      {stats.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5 text-sm font-normal text-neutral-500">
          <StatIcon stat={s} size={size} variant="glyph" />
          {STAT_LABELS[s]}
        </span>
      ))}
    </div>
  );
}

/** Fixed primaries as muted glyphs; choice stat as the only prominent element. */
function PieceStatDiffRow({
  archetype,
  highlightStat,
}: {
  archetype: Archetype;
  highlightStat: Stat;
}) {
  const [primary, secondary] = ARCHETYPE_STATS[archetype];

  return (
    <div className="flex items-center justify-center gap-3 w-full">
      <div
        className="flex items-center gap-1.5 text-neutral-500/50 shrink-0"
        aria-hidden
      >
        <StatIcon stat={primary} size="sm" variant="glyph" />
        <StatIcon stat={secondary} size="sm" variant="glyph" />
      </div>
      <span className="text-neutral-600 text-sm shrink-0" aria-hidden>
        /
      </span>
      <div className="flex flex-col items-center gap-2 rounded-lg bg-white/[0.06] ring-1 ring-white/20 px-5 py-3 min-w-[7rem]">
        <StatIcon stat={highlightStat} size="md" variant="glyph" />
        <span className="text-base font-semibold text-white leading-tight">
          {STAT_LABELS[highlightStat]}
        </span>
      </div>
    </div>
  );
}

export function SwipePickCard({
  label,
  stat,
  stats,
  focusArchetype,
  highlightRole = 'tertiary',
  onPick,
  disabled = false,
  className = '',
}: SwipePickCardProps) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const pieceContext = focusArchetype && stat;

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    touchStartY.current = e.touches[0]?.clientY ?? null;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? 0;
    const endY = e.changedTouches[0]?.clientY ?? 0;
    const dx = endX - touchStartX.current;
    const dy = endY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
    onPick();
  }

  const roleLabel = highlightRole === 'tuning' ? 'tuned stat' : 'third stat';
  const ariaLabel = pieceContext
    ? `Prefer ${STAT_LABELS[stat]} as ${roleLabel} on ${ARCHETYPE_LABELS[focusArchetype]} pieces`
    : label;

  return (
    <button
      type="button"
      onClick={onPick}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-busy={disabled}
      className={`min-h-32 h-full rounded-xl border border-border bg-surface-2 hover:bg-white/5 hover:border-white/20 transition-all active:scale-95 touch-pan-y flex flex-col items-center justify-center px-3 py-4 ${
        pieceContext ? 'font-normal' : 'font-semibold text-lg gap-2'
      } ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}
    >
      {pieceContext ? (
        <PieceStatDiffRow archetype={focusArchetype} highlightStat={stat} />
      ) : (
        <>
          {stat ? (
            <span className="flex items-center gap-2">
              <StatIcon stat={stat} size="md" variant="glyph" />
              <span>{label}</span>
            </span>
          ) : (
            <span>{label}</span>
          )}
          {stats && stats.length > 0 && <StatLabelsRow stats={stats} size="sm" />}
        </>
      )}
    </button>
  );
}
