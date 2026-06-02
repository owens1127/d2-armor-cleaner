import type { ItemTagIndicatorSize } from '@/components/items/ItemTagIndicator';
import type { BuildOptimalIndicatorVariant } from '@/lib/coverage/buildOptimal';

const SIZE_CLASS: Record<ItemTagIndicatorSize, string> = {
  xs: 'text-[8px] min-w-[13px] h-[13px] px-0.5',
  sm: 'text-[9px] min-w-[14px] h-[14px] px-0.5',
  md: 'text-[10px] min-w-[16px] h-[16px] px-0.5',
  lg: 'text-[11px] min-w-[18px] h-[18px] px-0.5',
};

const VARIANT_CLASS: Record<BuildOptimalIndicatorVariant, string> = {
  default:
    'bg-cyan-400 text-surface shadow-[0_0_4px_rgba(34,211,238,0.55)]',
  sole: 'bg-rose-400 text-surface shadow-[0_0_4px_rgba(251,113,133,0.62)]',
};

/** Build-target count badge - distinct from DIM tags (bottom-right) and copy count (top-left). */
export function BuildOptimalIndicator({
  count,
  title,
  size = 'md',
  variant = 'default',
}: {
  count: number;
  title: string;
  size?: ItemTagIndicatorSize;
  variant?: BuildOptimalIndicatorVariant;
}) {
  const display = count > 99 ? '99+' : String(count);

  return (
    <span
      className={`absolute top-[2px] right-[2px] z-[2] flex items-center justify-center rounded-full font-semibold tabular-nums leading-none pointer-events-auto ${SIZE_CLASS[size]} ${VARIANT_CLASS[variant]}`}
      title={title}
      aria-label={title}
    >
      {display}
    </span>
  );
}
