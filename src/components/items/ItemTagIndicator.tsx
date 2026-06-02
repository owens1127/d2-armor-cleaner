import {
  DIM_TAG_DEFINITIONS,
  dimTagGlyphPx,
  tagIconColor,
  tagIndicatorTitle,
} from '@/lib/dim/tagConfig';
import type { TagValue } from '@/types';

export type ItemTagIndicatorSize = 'xs' | 'sm' | 'md' | 'lg';

/** Tile widths used by `ItemIcon` — glyph size follows DIM (`tile / 5`). */
const TILE_PX: Record<ItemTagIndicatorSize, number> = {
  xs: 42,
  sm: 48,
  md: 64,
  lg: 80,
};

const INLINE_GLYPH_PX: Record<ItemTagIndicatorSize, number> = {
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
};

const DIM_TAG_DROP_SHADOW = 'drop-shadow(0 0 2px rgba(0, 0, 0, 0.8))';

function TagGlyph({
  tag,
  color,
  px,
  title,
}: {
  tag: TagValue;
  color: string;
  px: number;
  title: string;
}) {
  const def = DIM_TAG_DEFINITIONS[tag];
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 512 512"
      aria-hidden
      className="block shrink-0"
      style={{
        color,
        filter: DIM_TAG_DROP_SHADOW,
      }}
    >
      <title>{title}</title>
      <path fill="currentColor" d={def.svgPath} />
    </svg>
  );
}

export interface ItemTagIndicatorProps {
  dimTag?: TagValue | null;
  dimFavorite?: boolean;
  pendingTag?: TagValue | null;
  pendingColor?: string;
  size?: ItemTagIndicatorSize;
  /** When set, glyph size is `tilePx / 5` (DIM inventory tiles). */
  tilePx?: number;
  /** overlay: bottom-right on item icons; inline: flow in tables/labels */
  variant?: 'overlay' | 'inline';
  className?: string;
}

/** DIM-style tag glyphs (lime) plus pending keep/junk glyphs (green / red). */
export function ItemTagIndicator({
  dimTag,
  dimFavorite = false,
  pendingTag,
  pendingColor,
  size = 'md',
  tilePx,
  variant = 'overlay',
  className = '',
}: ItemTagIndicatorProps) {
  const showDimFavorite = dimFavorite || dimTag === 'favorite';
  const dimPrimaryTag =
    dimTag && dimTag !== 'favorite' ? dimTag : null;
  const showDimTag = Boolean(dimPrimaryTag);

  /** Pending is the sole glyph when queued; DIM allows one tag per item. */
  if (pendingTag) {
    const px =
      variant === 'overlay'
        ? dimTagGlyphPx(tilePx ?? TILE_PX[size])
        : INLINE_GLYPH_PX[size];
    const layoutClass =
      variant === 'overlay'
        ? 'pointer-events-none absolute right-[2px] bottom-[2px] z-[2] flex flex-row items-end justify-end gap-px'
        : 'inline-flex flex-row items-center justify-end gap-0.5';
    return (
      <div className={`${layoutClass} ${className}`} aria-hidden={false}>
        <TagGlyph
          tag={pendingTag}
          color={pendingColor ?? tagIconColor(pendingTag, 'pending')}
          px={px}
          title={tagIndicatorTitle(pendingTag, 'pending')}
        />
      </div>
    );
  }

  if (!showDimFavorite && !showDimTag) return null;

  const px =
    variant === 'overlay'
      ? dimTagGlyphPx(tilePx ?? TILE_PX[size])
      : INLINE_GLYPH_PX[size];
  const layoutClass =
    variant === 'overlay'
      ? 'pointer-events-none absolute right-[2px] bottom-[2px] z-[2] flex flex-row items-end justify-end gap-px'
      : 'inline-flex flex-row items-center justify-end gap-0.5';

  return (
    <div
      className={`${layoutClass} ${className}`}
      aria-hidden={!showDimFavorite && !showDimTag}
    >
      {showDimFavorite && (
        <TagGlyph
          tag="favorite"
          color={tagIconColor('favorite', 'dim')}
          px={px}
          title={tagIndicatorTitle('favorite', 'dim')}
        />
      )}
      {showDimTag && dimPrimaryTag && (
        <TagGlyph
          tag={dimPrimaryTag}
          color={tagIconColor(dimPrimaryTag, 'dim')}
          px={px}
          title={tagIndicatorTitle(dimPrimaryTag, 'dim')}
        />
      )}
    </div>
  );
}
