import type { ArmorPiece, DupeBucket } from '@/types';

interface HeatmapCellProps {
  impossible: boolean;
  bucket: DupeBucket | undefined;
  items: ArmorPiece[];
  onClick?: () => void;
  compact?: boolean;
}

export function HeatmapCell({ impossible, bucket, items, onClick, compact = false }: HeatmapCellProps) {
  const hasDupes = items.length >= 2;
  const avgWant =
    items.length > 0
      ? items.reduce((s, i) => s + (i.wantScore ?? 0), 0) / items.length
      : 0;
  const wantAlpha = Math.min(0.35, avgWant * 0.4);
  const hasMixedTuning =
    items.length > 1 && new Set(items.map((i) => i.tuningStat ?? 'none')).size > 1;

  return (
    <button
      type="button"
      disabled={impossible || items.length === 0}
      onClick={() => bucket && onClick?.()}
      style={
        !impossible && items.length > 0 && wantAlpha > 0.05
          ? {
              backgroundColor: `color-mix(in srgb, var(--color-accent) ${Math.round(wantAlpha * 100)}%, var(--color-surface-2))`,
            }
          : undefined
      }
      className={`
        relative aspect-square flex items-center justify-center font-bold transition-colors
        ${compact ? 'min-w-0 w-full text-xs' : 'min-w-12 text-sm'}
        ${impossible ? 'bg-[repeating-linear-gradient(45deg,var(--color-border),var(--color-border)_1px,transparent_1px,transparent_6px)] opacity-40 cursor-default' : ''}
        ${!impossible && items.length === 0 ? 'bg-surface text-muted/30 cursor-default' : ''}
        ${!impossible && items.length > 0 ? 'hover:bg-white/5 cursor-pointer' : ''}
        ${avgWant > 0.6 ? 'ring-1 ring-inset ring-white/15' : ''}
      `}
    >
      {!impossible && items.length > 0 && (
        <>
          <span className="text-white/80">{items.length}</span>
          {hasDupes && (
            <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-white" />
          )}
          {hasMixedTuning && (
            <span
              className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full bg-white/40"
              title="Mixed tuning stats in bucket"
            />
          )}
        </>
      )}
      {!impossible && items.length === 0 && <span className="text-muted/40 text-xs">×</span>}
    </button>
  );
}
