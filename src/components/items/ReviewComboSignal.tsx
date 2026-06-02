import type { BuildOptimalIndicatorVariant } from '@/lib/coverage/buildOptimal';

const CHIP_CLASS: Record<BuildOptimalIndicatorVariant, string> = {
  default: 'border-cyan-400/45 bg-cyan-400/10 text-cyan-200',
  sole: 'border-rose-400/45 bg-rose-400/10 text-rose-200',
};

const DOT_CLASS: Record<BuildOptimalIndicatorVariant, string> = {
  default: 'bg-cyan-400 shadow-[0_0_4px_rgba(34,211,238,0.55)]',
  sole: 'bg-rose-400 shadow-[0_0_4px_rgba(251,113,133,0.62)]',
};

export function ReviewComboSignal({
  count,
  variant,
  title,
  testId,
}: {
  count: number;
  variant: BuildOptimalIndicatorVariant;
  title: string;
  testId?: string;
}) {
  const displayCount = count > 99 ? '99+' : String(count);

  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] leading-none ${CHIP_CLASS[variant]}`}
      title={title}
      aria-label={title}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${DOT_CLASS[variant]}`} />
      {count > 1 && <span className="font-semibold tabular-nums">{displayCount}</span>}
    </span>
  );
}
