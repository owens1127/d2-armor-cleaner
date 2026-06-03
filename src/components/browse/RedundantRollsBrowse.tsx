import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrowseCardActionGrid } from '@/components/duel/BrowseCardActionGrid';
import {
  StatPill,
  TuningBadge,
  statCompareMap,
} from '@/components/duel/ArmorCard';
import { ItemIcon } from '@/components/items/ItemIcon';
import { ItemTagIndicator } from '@/components/items/ItemTagIndicator';
import { CopyDimQueriesButton } from '@/components/items/CopyDimQueryButton';
import {
  copyDimQueriesGroupAnnouncement,
  copyDimQueriesGroupAriaLabel,
} from '@/components/items/copyDimQuery';
import { ARCHETYPE_LABELS, CLASS_LABELS, SLOT_LABELS } from '@/lib/constants';
import type { ClassType, Stat } from '@/types';
import type {
  DismantleDisplayGroup,
  DismantleGroupMember,
} from '@/lib/dupes/dismantle';
import {
  analyzeRedundantGroupMatch,
  formatRedundantGroupLowerLine,
  formatRedundantGroupMatchingLine,
  redundantMemberStatEntries,
  type RedundantGroupMatch,
} from '@/lib/browse/redundantMatchDisplay';
import { setBrowseRedundantInParams } from '@/lib/browse/redundantFilter';
import { settingsPath } from '@/lib/nav';
import { DUPE_RULES_SECTION_ID } from '@/lib/nav/hashScroll';
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
    ARCHETYPE_LABELS[item.archetype],
    item.tier != null ? `T${item.tier}` : null,
    set ?? null,
  ].filter(Boolean);
  return parts.join(' · ');
}

function groupGridClass(count: number): string {
  if (count <= 1) return 'grid-cols-1';
  if (count <= 2) return 'grid-cols-1 sm:grid-cols-2';
  if (count <= 4) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
  return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
}

function statHighlightForMember(
  piece: ArmorPiece,
  match: RedundantGroupMatch,
  reason: DismantleDisplayGroup['reason'],
  comparePiece: ArmorPiece | null,
  stat: Stat,
): 'win' | 'lose' | 'tie' | undefined {
  if (reason === 'tuning-duplicate') {
    return match.allSameIntrinsicRoll ? 'tie' : undefined;
  }
  if (!comparePiece) return undefined;
  return statCompareMap(piece, comparePiece)[stat];
}

function RedundantMatchStatRow({
  piece,
  match,
  reason,
  comparePiece,
}: {
  piece: ArmorPiece;
  match: RedundantGroupMatch;
  reason: DismantleDisplayGroup['reason'];
  comparePiece: ArmorPiece | null;
}) {
  const entries = redundantMemberStatEntries(piece, match, reason);

  return (
    <div className="flex flex-wrap gap-1">
      {entries.map((entry) => (
        <StatPill
          key={`${entry.role ?? 'line'}-${entry.stat}`}
          stat={entry.stat}
          value={entry.value}
          role={entry.role}
          compact
          highlight={statHighlightForMember(
            piece,
            match,
            reason,
            comparePiece,
            entry.stat,
          )}
        />
      ))}
      {piece.tuningStat && (
        <TuningBadge
          stat={piece.tuningStat}
          differs={
            reason === 'stat-lower' &&
            comparePiece != null &&
            comparePiece.tuningStat !== piece.tuningStat
          }
        />
      )}
    </div>
  );
}

function RedundantGroupPieceTile({
  member,
  match,
  reason,
  comparePiece,
  onToggleKeep,
  onToggleFavorite,
  onToggleJunk,
}: {
  member: DismantleGroupMember;
  match: RedundantGroupMatch;
  reason: DismantleDisplayGroup['reason'];
  comparePiece: ArmorPiece | null;
  onToggleKeep: (piece: ArmorPiece) => void;
  onToggleFavorite: (piece: ArmorPiece) => void;
  onToggleJunk: (piece: ArmorPiece) => void;
}) {
  const { piece, role, copyCount } = member;
  const isKeeper = role === 'keeper';

  return (
    <article
      className={`flex flex-col rounded-lg border p-3 gap-2 min-w-0 ${
        isKeeper
          ? 'border-white/15 bg-white/[0.03] ring-1 ring-inset ring-white/10'
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

      <RedundantMatchStatRow
        piece={piece}
        match={match}
        reason={reason}
        comparePiece={comparePiece}
      />

      {isKeeper && (
        <span className="self-start text-[10px] text-white/45 tracking-wide">
          Suggested keep
        </span>
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

function RedundantGroupMatchSummary({
  match,
  reason,
}: {
  match: RedundantGroupMatch;
  reason: DismantleDisplayGroup['reason'];
}) {
  const matchingLine = formatRedundantGroupMatchingLine(match, reason);
  const lowerLine = formatRedundantGroupLowerLine(match);

  return (
    <div className="flex flex-col gap-2 mt-1 w-full basis-full">
      <p className="text-xs text-white/60 leading-relaxed">{matchingLine}</p>
      {lowerLine && (
        <p className="text-xs text-amber-200/75 leading-relaxed">{lowerLine}</p>
      )}
      {match.sharedStatEntries.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {match.sharedStatEntries.map((entry) => (
            <StatPill
              key={`shared-${entry.stat}`}
              stat={entry.stat}
              value={entry.value}
              role={entry.role}
              compact
              highlight="tie"
            />
          ))}
          {match.sharedTuning && <TuningBadge stat={match.sharedTuning} />}
        </div>
      )}
    </div>
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
  const match = useMemo(() => analyzeRedundantGroupMatch(group), [group]);
  const groupInstanceIds = useMemo(
    () => group.members.flatMap((member) => member.instanceIds),
    [group.members],
  );
  const firstRedundant =
    group.members.find((member) => member.role === 'redundant')?.piece ?? null;

  return (
    <section className="border border-border rounded-xl bg-surface overflow-hidden">
      <div className="w-full flex flex-wrap items-start gap-x-2 gap-y-1 px-4 py-3 hover:bg-white/[0.03] transition-colors">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex-1 min-w-0 flex flex-wrap items-start gap-x-2 gap-y-1 text-left"
          aria-expanded={!collapsed}
        >
          <span className="text-sm font-medium text-white">
            {SLOT_LABELS[group.slot]}
          </span>
          <span className="text-white/30" aria-hidden>
            ·
          </span>
          <span className="text-sm text-white/75">Pick one to keep</span>
          <span className="text-white/30" aria-hidden>
            ·
          </span>
          <span className="text-sm text-muted">
            {pieceCount} piece{pieceCount === 1 ? '' : 's'}
          </span>
          <RedundantGroupMatchSummary match={match} reason={group.reason} />
        </button>
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <CopyDimQueriesButton
            compact
            instanceIds={groupInstanceIds}
            ariaLabel={copyDimQueriesGroupAriaLabel(groupInstanceIds.length)}
            announcement={copyDimQueriesGroupAnnouncement(groupInstanceIds.length)}
          />
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="text-xs text-muted shrink-0"
          >
            {collapsed ? 'Show' : 'Hide'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="px-4 pb-4 pt-3 border-t border-border/60">
          <div className={`grid gap-3 ${groupGridClass(pieceCount)}`}>
            {group.members.map((member) => (
              <RedundantGroupPieceTile
                key={member.instanceIds.join('|')}
                member={member}
                match={match}
                reason={group.reason}
                comparePiece={
                  member.role === 'keeper' ? firstRedundant : match.keeper
                }
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
            {filteredCount} redundant piece{totalCandidateCount === 1 ? '' : 's'} across{' '}
            {groupList.length} group{groupList.length === 1 ? '' : 's'}. Each group shows matching
            stats and tuning side by side. Triage with keep, favorite, or junk, then confirm in
            DIM before dismantling.
          </p>
          <p className="text-muted text-xs mt-1.5 max-w-xl">
            Results feel too strict or too loose?{' '}
            <Link
              to={`${settingsPath(classType)}#${DUPE_RULES_SECTION_ID}`}
              className="underline hover:text-white/90"
            >
              Adjust dupe rules in Settings
            </Link>
            .
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
