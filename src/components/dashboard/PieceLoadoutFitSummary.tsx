import { StatIcon } from '@/components/StatIcon';
import { ARCHETYPE_LABELS, STAT_LABELS } from '@/lib/constants';
import { formatPieceLoadoutFitLabel, formatPieceRollSummary } from '@/lib/coverage/loadout';
import type { ArmorPiece, Stat } from '@/types';

function StatRoleLabel({ stat, role }: { stat: Stat; role: 'tertiary' | 'tuning' }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <StatIcon stat={stat} size="sm" variant="glyph" />
      <span>
        {STAT_LABELS[stat]} {role}
      </span>
    </span>
  );
}

function PieceRollDescriptor({
  piece,
  textClassName,
}: {
  piece: ArmorPiece;
  textClassName: string;
}) {
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 ${textClassName}`}>
      <span className="font-medium text-white/90">{ARCHETYPE_LABELS[piece.archetype]}</span>
      <span className="text-white/45">·</span>
      <StatRoleLabel stat={piece.tertiaryStat} role="tertiary" />
      {piece.tuningStat && (
        <>
          <span className="text-white/45">·</span>
          <StatRoleLabel stat={piece.tuningStat} role="tuning" />
        </>
      )}
    </span>
  );
}

export interface PieceLoadoutFitSummaryProps {
  piece: ArmorPiece;
  priorities: Stat[];
  /** `compact` - roll descriptor only (alternatives list). */
  variant?: 'default' | 'compact';
  className?: string;
}

/**
 * Plain-text roll summary for loadout rows.
 * Best-tier loadout pieces omit build-priority chips - shape is already optimal.
 */
export function PieceLoadoutFitSummary({
  piece,
  priorities,
  variant = 'default',
  className = '',
}: PieceLoadoutFitSummaryProps) {
  const ariaLabel = formatPieceLoadoutFitLabel(piece, priorities);
  const rollLine = formatPieceRollSummary(piece);

  if (variant === 'compact') {
    return (
      <p
        className={`text-[10px] text-white/55 leading-snug truncate ${className}`}
        aria-label={ariaLabel}
        title={rollLine}
      >
        <PieceRollDescriptor piece={piece} textClassName="" />
      </p>
    );
  }

  return (
    <p
      className={`text-[11px] text-white/65 leading-snug truncate ${className}`}
      aria-label={ariaLabel}
      title={rollLine}
    >
      <PieceRollDescriptor piece={piece} textClassName="" />
    </p>
  );
}
