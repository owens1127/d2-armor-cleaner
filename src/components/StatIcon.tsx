import { useState } from 'react';
import { STAT_COLORS } from '@/lib/constants';
import { statIconUrl } from '@/lib/items/icons';
import type { Stat } from '@/types';

type StatIconSize = 'sm' | 'md';
/** inline-bar: colored strip only; glyph: Bungie icon only; badge: bar + icon in subtle chip */
type StatIconVariant = 'inline-bar' | 'glyph' | 'badge';

interface StatIconProps {
  stat: Stat;
  size?: StatIconSize;
  variant?: StatIconVariant;
  className?: string;
}

const SIZE = {
  sm: { bar: 'w-1 h-3', badge: 'w-7 h-7', icon: 16 },
  md: { bar: 'w-1 h-4', badge: 'w-8 h-8', icon: 20 },
} as const;

function StatGlyphFallback({ stat, size }: { stat: Stat; size: number }) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (stat) {
    case 'weapons':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
        </svg>
      );
    case 'grenade':
      return (
        <svg {...props}>
          <path d="M10 4h4l1 3H9l1-3z" />
          <ellipse cx="12" cy="14.5" rx="5.5" ry="6.5" />
          <path d="M12 8v2" />
        </svg>
      );
    case 'super':
      return (
        <svg {...props}>
          <path d="M12 3l2.2 6.5H21l-5.5 4 2.2 6.5L12 16l-5.7 4 2.2-6.5L3 9.5h6.8L12 3z" />
        </svg>
      );
    case 'melee':
      return (
        <svg {...props}>
          <path d="M9 8c0-2 1.5-3.5 3-3.5S15 6 15 8v2.5c0 1.5-.8 2.5-2 3l-1 5.5M11 18.5h2" />
          <path d="M10 11h4" />
        </svg>
      );
    case 'health':
      return (
        <svg {...props}>
          <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.5-7 10-7 10z" />
        </svg>
      );
    case 'class':
      return (
        <svg {...props}>
          <path d="M12 4l6 4-6 4-6-4 6-4z" />
          <path d="M6 12l6 4 6-4M6 16l6 4 6-4" />
        </svg>
      );
  }
}

function StatGlyphImage({ stat, size }: { stat: Stat; size: number }) {
  const [useFallback, setUseFallback] = useState(false);
  const src = statIconUrl(stat);

  if (useFallback || !src) {
    return (
      <span className="text-white/75 inline-flex shrink-0" aria-hidden>
        <StatGlyphFallback stat={stat} size={size} />
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="shrink-0 brightness-0 invert opacity-80"
      aria-hidden
      onError={() => setUseFallback(true)}
    />
  );
}

export function StatIcon({
  stat,
  size = 'sm',
  variant = 'badge',
  className = '',
}: StatIconProps) {
  const s = SIZE[size];
  const color = STAT_COLORS[stat];

  if (variant === 'inline-bar') {
    return (
      <span
        className={`${s.bar} rounded-full shrink-0 ${className}`}
        style={{ backgroundColor: color }}
        aria-hidden
      />
    );
  }

  if (variant === 'glyph') {
    return (
      <span className={`inline-flex shrink-0 ${className}`} aria-hidden>
        <StatGlyphImage stat={stat} size={s.icon} />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center gap-1 shrink-0 rounded-md bg-white/5 ${s.badge} ${className}`}
      title={stat}
    >
      <span
        className={`${s.bar} rounded-full shrink-0`}
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <StatGlyphImage stat={stat} size={s.icon} />
    </span>
  );
}
