import { CLASS_GLYPH_PATHS } from '@/lib/items/class-glyphs';
import { classLabel } from '@/i18n/gameCopy';
import type { ClassType } from '@/types';

interface ClassIconProps {
  classType: ClassType;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE = { xs: 24, sm: 40, md: 56, lg: 72 } as const;

function ClassGlyph({ classType, size }: { classType: ClassType; size: number }) {
  const paths = CLASS_GLYPH_PATHS[classType];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
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

/** Monochrome Guardian class silhouette (tier5-style) with accessible class name. */
export function ClassIcon({ classType, size = 'md', className = '' }: ClassIconProps) {
  const px = SIZE[size];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center text-white/75 ${className}`}
      role="img"
      aria-label={classLabel(classType)}
    >
      <ClassGlyph classType={classType} size={px} />
    </span>
  );
}
