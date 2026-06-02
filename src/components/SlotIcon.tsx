import { SLOT_LABELS } from '@/lib/constants';
import { SLOT_GLYPH_PATHS } from '@/lib/items/slot-glyphs';
import type { ArmorSlot } from '@/types';

type SlotIconSize = 'sm' | 'md';

interface SlotIconProps {
  slot: ArmorSlot;
  size?: SlotIconSize;
  className?: string;
}

const SIZE = {
  sm: 20,
  md: 24,
} as const;

function SlotGlyph({ slot, size }: { slot: ArmorSlot; size: number }) {
  const paths = SLOT_GLYPH_PATHS[slot];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 51 51"
      fill="currentColor"
      aria-hidden
      className="shrink-0"
    >
      {paths.map((d, index) => (
        <path key={index} d={d} />
      ))}
    </svg>
  );
}

/** Monochrome armor slot silhouette (tier5-style) with accessible slot name. */
export function SlotIcon({ slot, size = 'sm', className = '' }: SlotIconProps) {
  const px = SIZE[size];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center text-white/75 ${className}`}
      role="img"
      aria-label={SLOT_LABELS[slot]}
    >
      <SlotGlyph slot={slot} size={px} />
    </span>
  );
}
