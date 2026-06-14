import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { classLabel, statLabel, archetypeLabel, slotLabel } from '@/i18n/gameCopy';
import {
  ARCHETYPES,
  ARMOR_SLOTS,
  isImpossibleCell,
  tertiaryStatsForArchetype,
} from '@/lib/constants';
import { ClassIcon } from '@/components/items/ClassIcon';
import { SlotIcon } from '@/components/SlotIcon';
import { StatIcon } from '@/components/StatIcon';
import { HeatmapCell } from '@/components/heatmap/HeatmapCell';
import {
  bucketsForHeatmapCell,
  mergeHeatmapCellItems,
  mergedHeatmapBucket,
} from '@/lib/heatmap/cell';
import { useSessionStore } from '@/stores';
import type {
  Archetype,
  ArmorPiece,
  ArmorSlot,
  ClassType,
  ClassVaultState,
  DupeBucket,
  PendingTag,
} from '@/types';

export type HeatmapViewMode = 'armor' | 'archetype';

/** Column header / row-label icons - larger than table chips, fits 12-col armor grid. */
const HEATMAP_HEADER_STAT_SIZE = 'md' as const;
const HEATMAP_ROW_SLOT_SIZE = 'md' as const;

interface HeatmapProps {
  classState: ClassVaultState;
  onCellClick?: (bucket: DupeBucket) => void;
  slotFilter?: ArmorSlot | 'all';
  viewMode?: HeatmapViewMode;
  focusArchetype?: Archetype;
}

function heatmapCell(
  buckets: DupeBucket[],
  archetype: DupeBucket['key']['archetype'],
  slot: DupeBucket['key']['armorSlot'],
  tertiary: DupeBucket['key']['tertiaryStat'],
  pendingTags: PendingTag[],
  bucketJunkedIds: string[],
): { items: ArmorPiece[]; bucket: DupeBucket | undefined } {
  const cellBuckets = bucketsForHeatmapCell(buckets, archetype, slot, tertiary);
  return {
    items: mergeHeatmapCellItems(cellBuckets, pendingTags, bucketJunkedIds),
    bucket: mergedHeatmapBucket(cellBuckets),
  };
}

function ClassHeatmapSidebar({ classType }: { classType: ClassType }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 shrink-0 w-10 self-stretch border border-border rounded-xl bg-surface-2/80"
      aria-label={`${classLabel(classType)} vault heatmap`}
    >
      <ClassIcon classType={classType} size="xs" className="text-muted" />
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted select-none"
        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
      >
        {classLabel(classType)}
      </span>
    </div>
  );
}

function renderCell(
  items: ArmorPiece[],
  bucket: DupeBucket | undefined,
  impossible: boolean,
  onCellClick?: (bucket: DupeBucket) => void,
  compact = false,
) {
  return (
    <HeatmapCell
      impossible={impossible}
      bucket={bucket}
      items={items}
      compact={compact}
      onClick={() => bucket && onCellClick?.(bucket)}
    />
  );
}

function ArchetypeFocusGrid({
  classState,
  archetype,
  visibleSlots,
  pendingTags,
  bucketJunkedIds,
  onCellClick,
}: {
  classState: ClassVaultState;
  archetype: Archetype;
  visibleSlots: ArmorSlot[];
  pendingTags: PendingTag[];
  bucketJunkedIds: string[];
  onCellClick?: (bucket: DupeBucket) => void;
}) {
  const tertiaries = tertiaryStatsForArchetype(archetype);
  return (
    <div
      className="grid gap-px bg-border rounded-xl overflow-hidden border border-border max-w-2xl"
      style={{
        gridTemplateColumns: `4.5rem repeat(${tertiaries.length}, minmax(3.5rem, 1fr))`,
      }}
    >
      <div className="bg-surface-2" />
      {tertiaries.map((stat) => (
        <div
          key={stat}
          className="bg-surface-2 flex items-center justify-center py-2 min-h-[2rem]"
          title={statLabel(stat)}
        >
          <StatIcon stat={stat} size={HEATMAP_HEADER_STAT_SIZE} variant="glyph" />
        </div>
      ))}
      {visibleSlots.map((slot) => (
        <Fragment key={slot}>
          <div className="bg-surface-2 flex items-center justify-center px-1 py-1.5 min-h-[2rem]">
            <SlotIcon slot={slot} size={HEATMAP_ROW_SLOT_SIZE} />
          </div>
          {tertiaries.map((tertiary) => {
            const { items, bucket } = heatmapCell(
              classState.buckets,
              archetype,
              slot,
              tertiary,
              pendingTags,
              bucketJunkedIds,
            );
            return (
              <Fragment key={`${slot}-${tertiary}`}>
                {renderCell(items, bucket, false, onCellClick)}
              </Fragment>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

function ArmorViewGrid({
  classState,
  visibleSlots,
  pendingTags,
  bucketJunkedIds,
  onCellClick,
}: {
  classState: ClassVaultState;
  visibleSlots: ArmorSlot[];
  pendingTags: PendingTag[];
  bucketJunkedIds: string[];
  onCellClick?: (bucket: DupeBucket) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 min-w-0 w-full">
      {ARCHETYPES.map((archetype) => (
        <div key={archetype} className="flex flex-col gap-1 min-w-0">
          <div className="text-center mb-1 px-0.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted truncate">
              {archetypeLabel(archetype)}
            </div>
          </div>
          <div
            className="grid gap-px bg-border rounded-xl overflow-hidden border border-border w-full min-w-0"
            style={{
              gridTemplateColumns: `2rem repeat(${tertiaryStatsForArchetype(archetype).length}, minmax(0, 1fr))`,
            }}
          >
            <div className="bg-surface-2" />
            {tertiaryStatsForArchetype(archetype).map((stat) => (
              <div
                key={stat}
                className="bg-surface-2 flex items-center justify-center py-2 min-h-[1.75rem]"
                title={statLabel(stat)}
              >
                <StatIcon stat={stat} size={HEATMAP_HEADER_STAT_SIZE} variant="glyph" />
              </div>
            ))}
            {visibleSlots.map((slot) => (
              <Fragment key={`${archetype}-${slot}`}>
                <div className="bg-surface-2 flex items-center justify-center px-0.5 py-1.5 min-h-[1.75rem]">
                  <SlotIcon slot={slot} size={HEATMAP_ROW_SLOT_SIZE} />
                </div>
                {tertiaryStatsForArchetype(archetype).map((tertiary) => {
                  const impossible = isImpossibleCell(archetype, tertiary);
                  const { items, bucket } = heatmapCell(
                    classState.buckets,
                    archetype,
                    slot,
                    tertiary,
                    pendingTags,
                    bucketJunkedIds,
                  );
                  return (
                    <Fragment key={`${slot}-${tertiary}`}>
                      {renderCell(items, bucket, impossible, onCellClick, true)}
                    </Fragment>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Heatmap({
  classState,
  onCellClick,
  slotFilter = 'all',
  viewMode = 'armor',
  focusArchetype = 'gunner',
}: HeatmapProps) {
  const { t } = useTranslation('game');
  const pendingTags = useSessionStore((s) => s.pendingTags);
  const bucketJunkedIds = useSessionStore((s) => s.bucketJunkedIds);
  const visibleSlots =
    slotFilter === 'all' ? ARMOR_SLOTS : ARMOR_SLOTS.filter((s) => s === slotFilter);

  return (
    <div className="flex gap-3 items-stretch">
      <ClassHeatmapSidebar classType={classState.classType} />
      <div className="min-w-0 flex-1">
        <div className={viewMode === 'armor' ? 'heatmap-scroll overflow-x-auto pb-0.5' : ''}>
          {viewMode === 'archetype' ? (
            <ArchetypeFocusGrid
              classState={classState}
              archetype={focusArchetype}
              visibleSlots={visibleSlots}
              pendingTags={pendingTags}
              bucketJunkedIds={bucketJunkedIds}
              onCellClick={onCellClick}
            />
          ) : (
            <ArmorViewGrid
              classState={classState}
              visibleSlots={visibleSlots}
              pendingTags={pendingTags}
              bucketJunkedIds={bucketJunkedIds}
              onCellClick={onCellClick}
            />
          )}
        </div>
        <p className="text-xs text-muted mt-2">
          {classLabel(classState.classType)} · count per cell (excludes junk) · tint = avg interest ·
          white dot = dupes · dim dot = mixed tuning
          {viewMode === 'armor'
            ? ` · ${t('heatmap.armorView', { count: ARCHETYPES.length })}`
            : ` · archetype view (${archetypeLabel(focusArchetype)})`}
          {slotFilter !== 'all' && ` · ${slotLabel(slotFilter)} only`}
        </p>
      </div>
    </div>
  );
}
