import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrowseCardActionGrid } from '@/components/duel/BrowseCardActionGrid';
import { ItemIcon } from '@/components/items/ItemIcon';
import { ItemTagIndicator } from '@/components/items/ItemTagIndicator';
import { ARCHETYPE_LABELS, CLASS_LABELS, SLOT_LABELS } from '@/lib/constants';
import type { ClassType } from '@/types';
import type {
  DismantleDisplayGroup,
  DismantleGroupMember,
} from '@/lib/dupes/dismantle';
import {
  formatRedundantMemberDetail,
  redundantGroupReasonLabel,
} from '@/lib/browse/redundantReason';
import { setBrowseRedundantInParams } from '@/lib/browse/redundantFilter';
import type { ArmorPiece } from '@/types';

export interface RedundantRollsBrowseProps {
  classType: ClassType;
  searchParams: URLSearchParams;
  groups: DismantleDisplayGroup[];
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

function keeperAnchorId(groupId: string): string {
  return `redundant-keeper-${groupId}`;
}

function RedundantGroupPieceTile({
  groupId,
  member,
  onToggleKeep,
  onToggleFavorite,
  onToggleJunk,
}: {
  groupId: string;
  member: DismantleGroupMember;
  onToggleKeep: (piece: ArmorPiece) => void;
  onToggleFavorite: (piece: ArmorPiece) => void;
  onToggleJunk: (piece: ArmorPiece) => void;
}) {
  const { piece, role, candidate, copyCount } = member;
  const isKeeper = role === 'keeper';
  const memberDetail =
    !isKeeper && candidate ? formatRedundantMemberDetail(candidate) : null;

  return (
    <article
      id={isKeeper ? keeperAnchorId(groupId) : undefined}
      className={`flex flex-col rounded-lg border p-3 gap-2 min-w-0 scroll-mt-24 ${
        isKeeper
          ? 'border-emerald-500/25 bg-emerald-500/[0.06]'
          : 'border-border bg-surface-2/80'
      }`}
    >
      <div className="flex gap-2.5 min-w-0">
        <div className="relative shrink-0">
          <ItemIcon piece={piece} size="sm" />
          <ItemTagIndicator
            dimTag={piece.dimTag}
            dimFavorite={piece.dimFavorite}
            size="xs"
            className="absolute -bottom-0.5 -right-0.5"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5 min-w-0">
            <span
              className="font-medium text-white text-sm leading-snug line-clamp-2"
              title={piece.name}
            >
              {piece.name}
            </span>
            {copyCount > 1 && (
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted px-1 py-0.5 rounded bg-white/5">
                ×{copyCount}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted mt-0.5 line-clamp-2" title={rollMetaLine(piece)}>
            {rollMetaLine(piece)}
          </p>
        </div>
      </div>

      <span
        className={`self-start text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
          isKeeper
            ? 'bg-emerald-500/15 text-emerald-200/90'
            : 'bg-white/8 text-white/55'
        }`}
      >
        {isKeeper ? 'Keep' : 'Redundant'}
      </span>

      {memberDetail && (
        <p className="text-[11px] text-white/50 leading-snug">{memberDetail}</p>
      )}

      <div className="mt-auto pt-1">
        <BrowseCardActionGrid
          piece={piece}
          onToggleKeep={onToggleKeep}
          onToggleFavorite={onToggleFavorite}
          onToggleJunk={onToggleJunk}
        />
      </div>
    </article>
  );
}

function RedundantDupeGroup({
  group,
  collapsed,
  onToggleCollapsed,
  onToggleKeep,
  onToggleFavorite,
  onToggleJunk,
}: {
  group: DismantleDisplayGroup;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onToggleKeep: (piece: ArmorPiece) => void;
  onToggleFavorite: (piece: ArmorPiece) => void;
  onToggleJunk: (piece: ArmorPiece) => void;
}) {
  const pieceCount = group.members.length;
  const redundantCount = group.members.filter((m) => m.role === 'redundant').length;
  const keeper = group.members.find((m) => m.role === 'keeper');
  const keeperAnchor = keeperAnchorId(group.id);

  const scrollToKeeper = useCallback(() => {
    document.getElementById(keeperAnchor)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [keeperAnchor]);

  return (
    <section className="border border-border rounded-xl bg-surface overflow-hidden">
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="w-full flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
        aria-expanded={!collapsed}
      >
        <span className="text-sm font-medium text-white">
          {SLOT_LABELS[group.slot]}
        </span>
        <span className="text-white/30" aria-hidden>
          ·
        </span>
        <span className="text-sm text-white/80">{redundantGroupReasonLabel(group.reason)}</span>
        <span className="text-white/30" aria-hidden>
          ·
        </span>
        <span className="text-sm text-muted">
          {pieceCount} piece{pieceCount === 1 ? '' : 's'}
          {redundantCount > 0 && (
            <span className="text-white/40">
              {' '}
              ({redundantCount} redundant)
            </span>
          )}
        </span>
        <span className="ml-auto text-xs text-muted">{collapsed ? 'Show' : 'Hide'}</span>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 pt-0 border-t border-border/60">
          {group.reason === 'tuning-duplicate' && keeper && (
            <p className="text-xs text-white/55 mt-3 mb-3 leading-relaxed">
              Same tuning layouts —{' '}
              <button
                type="button"
                onClick={scrollToKeeper}
                className="text-white/80 hover:text-white underline underline-offset-2"
              >
                {keeper.piece.name}
              </button>{' '}
              is the suggested keep; triage the rest in this group.
            </p>
          )}
          {group.reason === 'stat-lower' && keeper && (
            <p className="text-xs text-white/55 mt-3 mb-3 leading-relaxed">
              Strictly lower than{' '}
              <button
                type="button"
                onClick={scrollToKeeper}
                className="text-white/80 hover:text-white underline underline-offset-2"
              >
                {keeper.piece.name}
              </button>
              .
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {group.members.map((member) => (
              <RedundantGroupPieceTile
                key={member.instanceIds.join('|')}
                groupId={group.id}
                member={member}
                onToggleKeep={onToggleKeep}
                onToggleFavorite={onToggleFavorite}
                onToggleJunk={onToggleJunk}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function RedundantRollsBrowse({
  classType,
  searchParams,
  groups,
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

  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const toggleCollapsed = useCallback((groupId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const groupList = useMemo(() => groups, [groups]);

  return (
    <>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Redundant rolls · {CLASS_LABELS[classType]}
          </h1>
          <p className="text-muted text-sm mt-2 max-w-xl leading-relaxed">
            {filteredCount} of {totalCandidateCount} redundant piece
            {totalCandidateCount === 1 ? '' : 's'} in {groupList.length} group
            {groupList.length === 1 ? '' : 's'}. Each group shows the roll to keep and
            strictly lower or tuning-duplicate pieces. Confirm in DIM before dismantling.
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

      {groupList.length > 0 && (
        <div className="flex flex-col gap-4">
          {groupList.map((group) => (
            <RedundantDupeGroup
              key={group.id}
              group={group}
              collapsed={collapsedIds.has(group.id)}
              onToggleCollapsed={() => toggleCollapsed(group.id)}
              onToggleKeep={onToggleKeep}
              onToggleFavorite={onToggleFavorite}
              onToggleJunk={onToggleJunk}
            />
          ))}
        </div>
      )}
    </>
  );
}
