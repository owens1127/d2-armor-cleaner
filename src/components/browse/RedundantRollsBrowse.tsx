import { Link } from 'react-router-dom';
import { BrowseCardActionGrid } from '@/components/duel/BrowseCardActionGrid';
import { ItemIcon } from '@/components/items/ItemIcon';
import { ItemTagIndicator } from '@/components/items/ItemTagIndicator';
import { ARCHETYPE_LABELS, ARMOR_SLOTS, CLASS_LABELS, SLOT_LABELS } from '@/lib/constants';
import type { ArmorSlot } from '@/types';
import type { DismantleDisplayEntry } from '@/lib/dupes/dismantle';
import {
  formatRedundantReasonLine,
  redundantReasonBadge,
} from '@/lib/browse/redundantReason';
import { setBrowseRedundantInParams } from '@/lib/browse/redundantFilter';
import type { ArmorPiece, ClassType } from '@/types';

export interface RedundantRollsBrowseProps {
  classType: ClassType;
  searchParams: URLSearchParams;
  entriesBySlot: Map<ArmorSlot, DismantleDisplayEntry[]>;
  totalCandidateCount: number;
  onToggleKeep: (piece: ArmorPiece) => void;
  onToggleFavorite: (piece: ArmorPiece) => void;
  onToggleJunk: (piece: ArmorPiece) => void;
  onCopyAllIds: () => void;
  copiedAll: boolean;
  filteredCount: number;
  filtersActive: boolean;
}

function rollMetaLine(item: ArmorPiece): string {
  const set = item.armorSet?.name;
  const parts = [
    SLOT_LABELS[item.armorSlot],
    ARCHETYPE_LABELS[item.archetype],
    item.tier != null ? `T${item.tier}` : null,
    set ?? null,
  ].filter(Boolean);
  return parts.join(' · ');
}

function RedundantRollRow({
  entry,
  onToggleKeep,
  onToggleFavorite,
  onToggleJunk,
}: {
  entry: DismantleDisplayEntry;
  onToggleKeep: (piece: ArmorPiece) => void;
  onToggleFavorite: (piece: ArmorPiece) => void;
  onToggleJunk: (piece: ArmorPiece) => void;
}) {
  const { item, copyCount } = entry;
  const reasonLine = formatRedundantReasonLine(entry);
  const badge = redundantReasonBadge(entry.reason);

  return (
    <li className="flex items-stretch gap-3 px-3 py-2.5 hover:bg-white/[0.03] transition-colors">
      <div className="relative shrink-0 self-center">
        <ItemIcon piece={item} size="sm" />
        <ItemTagIndicator
          dimTag={item.dimTag}
          dimFavorite={item.dimFavorite}
          size="xs"
          className="absolute -bottom-0.5 -right-0.5"
        />
      </div>
      <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-medium text-white truncate" title={item.name}>
            {item.name}
          </span>
          {copyCount > 1 && (
            <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted px-1.5 py-0.5 rounded bg-white/5">
              ×{copyCount}
            </span>
          )}
          <span
            className={`shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
              entry.reason === 'stat-lower'
                ? 'bg-amber-500/15 text-amber-200/90'
                : 'bg-violet-500/15 text-violet-200/90'
            }`}
          >
            {badge}
          </span>
        </div>
        <p className="text-xs text-muted truncate" title={rollMetaLine(item)}>
          {rollMetaLine(item)}
        </p>
        <p className="text-xs text-white/55 leading-snug" title={reasonLine}>
          {reasonLine}
        </p>
      </div>
      <div className="shrink-0 self-center">
        <BrowseCardActionGrid
          piece={item}
          onToggleKeep={onToggleKeep}
          onToggleFavorite={onToggleFavorite}
          onToggleJunk={onToggleJunk}
        />
      </div>
    </li>
  );
}

export function RedundantRollsBrowse({
  classType,
  searchParams,
  entriesBySlot,
  totalCandidateCount,
  onToggleKeep,
  onToggleFavorite,
  onToggleJunk,
  onCopyAllIds,
  copiedAll,
  filteredCount,
  filtersActive,
}: RedundantRollsBrowseProps) {
  const browseAllParams = setBrowseRedundantInParams(searchParams, false);
  const browseAllTo = `/browse/${classType}${browseAllParams.toString() ? `?${browseAllParams}` : ''}`;

  const visibleSlots = ARMOR_SLOTS.filter((s) => (entriesBySlot.get(s)?.length ?? 0) > 0);

  return (
    <>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Redundant rolls · {CLASS_LABELS[classType]}
          </h1>
          <p className="text-muted text-sm mt-2 max-w-xl leading-relaxed">
            {filteredCount} of {totalCandidateCount} piece
            {totalCandidateCount === 1 ? '' : 's'} strictly worse or tuning-duplicate vs another
            roll you keep in the same slot. Confirm in DIM before dismantling.
          </p>
        </div>
        <Link
          to={browseAllTo}
          className="shrink-0 text-sm px-3 py-2 rounded-lg border border-border hover:bg-white/5 text-white/90"
        >
          Browse all armor
        </Link>
      </div>

      {filteredCount > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={onCopyAllIds}
            className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-white/5"
          >
            {copiedAll ? 'Copied!' : `Copy ${filteredCount} id: query`}
          </button>
          <Link
            to="/review"
            className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-white/5"
          >
            Review queued tags
          </Link>
        </div>
      )}

      {filteredCount === 0 && (
        <div className="text-center py-16 px-4 border border-border rounded-xl bg-surface-2">
          {totalCandidateCount === 0 ? (
            <>
              <p className="text-white font-medium mb-2">No redundant rolls</p>
              <p className="text-muted text-sm max-w-md mx-auto">
                Nothing in this class is strictly worse or a tuning duplicate under your dupe
                rules. Adjust rules in settings if you expected candidates.
              </p>
            </>
          ) : (
            <>
              <p className="text-white font-medium mb-2">No matches</p>
              <p className="text-muted text-sm">
                {filtersActive
                  ? 'No redundant rolls match the current filters.'
                  : 'No redundant rolls to show.'}
              </p>
            </>
          )}
          <Link
            to={browseAllTo}
            className="inline-block mt-6 text-sm text-white/80 hover:text-white underline"
          >
            Browse all armor
          </Link>
        </div>
      )}

      {visibleSlots.map((slot) => {
        const entries = entriesBySlot.get(slot) ?? [];
        if (entries.length === 0) return null;
        return (
          <section key={slot} className="mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 px-1">
              {SLOT_LABELS[slot]}
              <span className="font-normal text-white/40 ml-2">{entries.length}</span>
            </h2>
            <ul className="border border-border rounded-xl overflow-hidden divide-y divide-border bg-surface">
              {entries.map((entry) => (
                <RedundantRollRow
                  key={entry.instanceIds.join('|')}
                  entry={entry}
                  onToggleKeep={onToggleKeep}
                  onToggleFavorite={onToggleFavorite}
                  onToggleJunk={onToggleJunk}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
