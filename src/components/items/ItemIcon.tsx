import { bungieIconUrl, itemIconUrl, slotIconUrl, SLOT_FALLBACK_SVG } from '@/lib/items/icons';
import { BuildOptimalIndicator } from '@/components/items/BuildOptimalIndicator';
import { useBuildOptimalForPiece } from '@/components/items/buildOptimalContext';
import { ItemTagIndicator } from '@/components/items/ItemTagIndicator';
import { usePendingTagForInstance } from '@/components/items/pendingTagsContext';
import type { BuildOptimalIndicatorVariant } from '@/lib/coverage/buildOptimal';
import type { ArmorPiece, TagValue } from '@/types';
import { hasDisplayTier } from '@/lib/armor/tier';

interface ItemIconProps {
  piece: Pick<
    ArmorPiece,
    | 'icon'
    | 'armorSlot'
    | 'tier'
    | 'isMasterwork'
    | 'name'
    | 'instanceId'
    | 'dimTag'
    | 'dimFavorite'
    | 'classType'
    | 'archetype'
    | 'tertiaryStat'
    | 'tuningStat'
  >;
  size?: 'sm' | 'md' | 'lg';
  /** When set, skips session-store lookup for pending tags. */
  pendingTag?: TagValue | null;
  /** Identical roll copies in scope (vault, bucket, etc.). Shown top-left when > 1. */
  copyCount?: number;
  /** Tooltip for the copy count badge. */
  copyCountTitle?: string;
  /** Override build-optimal lookup (e.g. tests). */
  buildOptimal?: boolean;
  buildOptimalCount?: number;
  buildOptimalTitle?: string;
  buildOptimalVariant?: BuildOptimalIndicatorVariant;
  /** Limit sole red badge to one target armor set (Combos set column). */
  buildOptimalSetScope?: number;
}

const SIZE = { sm: 48, md: 64, lg: 80 } as const;

function CopyCountBadge({ count, title }: { count: number; title: string }) {
  return (
    <span
      className="absolute top-[2px] left-[2px] z-[2] text-[9px] leading-none font-semibold tabular-nums bg-black/75 text-white/90 px-1 py-0.5 rounded pointer-events-auto"
      title={title}
      aria-label={title}
    >
      ×{count}
    </span>
  );
}

export function ItemIcon({
  piece,
  size = 'md',
  pendingTag: pendingTagProp,
  copyCount,
  copyCountTitle,
  buildOptimal: buildOptimalProp,
  buildOptimalCount: buildOptimalCountProp,
  buildOptimalTitle: buildOptimalTitleProp,
  buildOptimalVariant: buildOptimalVariantProp,
  buildOptimalSetScope,
}: ItemIconProps) {
  const px = SIZE[size];
  const src = itemIconUrl(piece);
  const pendingFromContext = usePendingTagForInstance(piece.instanceId);
  const pendingTag = pendingTagProp !== undefined ? pendingTagProp : pendingFromContext;
  const fromBuildOptimal = useBuildOptimalForPiece(piece, {
    setScopeHash: buildOptimalSetScope,
  });
  const buildOptimalCount =
    buildOptimalCountProp ?? fromBuildOptimal.buildOptimalCount;
  const buildOptimal = buildOptimalProp ?? buildOptimalCount > 0;
  const buildOptimalTitle = buildOptimalTitleProp ?? fromBuildOptimal.buildOptimalTitle;
  const buildOptimalVariant =
    buildOptimalVariantProp ?? fromBuildOptimal.buildOptimalVariant;

  return (
    <div
      className={`relative shrink-0 rounded-md ui-item-frame ${
        piece.isMasterwork ? 'ui-item-frame--mw' : ''
      }`}
      style={{ width: px, height: px }}
    >
      <div className="absolute inset-0 overflow-hidden rounded-md">
        <img
          src={src}
          alt=""
          width={px}
          height={px}
          className="w-full h-full object-cover bg-surface-3"
          loading="lazy"
          onError={(e) => {
            const el = e.currentTarget;
            if (el.dataset.fallback === 'svg') return;
            if (!el.dataset.fallback && bungieIconUrl(piece.icon)) {
              el.dataset.fallback = 'slot';
              el.src = slotIconUrl(piece.armorSlot);
              return;
            }
            el.dataset.fallback = 'svg';
            el.src = SLOT_FALLBACK_SVG[piece.armorSlot];
          }}
        />
        {hasDisplayTier(piece.tier) && piece.tier >= 5 && (
          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/30" aria-hidden />
        )}
      </div>
      {copyCount !== undefined && copyCount > 1 && (
        <CopyCountBadge
          count={copyCount}
          title={
            copyCountTitle ??
            `${copyCount} copies of this roll`
          }
        />
      )}
      {buildOptimal && buildOptimalTitle && (
        <BuildOptimalIndicator
          count={buildOptimalCount}
          title={buildOptimalTitle}
          size={size}
          variant={buildOptimalVariant}
        />
      )}
      <ItemTagIndicator
        dimTag={piece.dimTag}
        dimFavorite={piece.dimFavorite}
        pendingTag={pendingTag}
        size={size}
        tilePx={px}
      />
    </div>
  );
}
