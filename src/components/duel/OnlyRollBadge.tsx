import { ONLY_ROLL_LABEL, ONLY_ROLL_TOOLTIP } from '@/lib/armor/uniqueRoll';

export function OnlyRollBadge({
  compact = false,
  tooltip = ONLY_ROLL_TOOLTIP,
}: {
  compact?: boolean;
  tooltip?: string;
}) {
  return (
    <span
      title={tooltip}
      aria-label={tooltip}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-0.5 shrink-0 rounded-md border border-amber-400/35 bg-amber-400/10 text-amber-200/90 cursor-help ${
        compact ? 'min-h-5 min-w-5 justify-center px-1 py-0.5 text-[9px]' : 'px-1.5 py-0.5 text-[10px]'
      } font-semibold uppercase tracking-wider`}
    >
      <span className="leading-none" aria-hidden>
        ★
      </span>
      {!compact && <span className="leading-none">{ONLY_ROLL_LABEL}</span>}
    </span>
  );
}
