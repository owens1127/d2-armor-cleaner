import { dimTagMatchesPending } from '@/lib/session/reviewTags';
import { LS_LOCAL_DIM_TAG_OVERRIDES } from '@/lib/storage/keys';
import type { DimItemTagState } from '@/lib/dim/parseTags';
import { parseDimItemTag } from '@/lib/dim/parseTags';
import type { ArmorPiece, TagValue } from '@/types';

export interface LocalDimTagOverride {
  tag: TagValue | null;
  changedAt: number;
}

type OverridesByMembership = Record<string, Record<string, LocalDimTagOverride>>;

export function dimStateMatchesTag(state: DimItemTagState, tag: TagValue | null): boolean {
  return dimTagMatchesPending(
    { dimTag: state.dimTag, dimFavorite: state.dimFavorite },
    tag,
  );
}

export function dimItemTagStateFromTag(tag: TagValue | null): DimItemTagState {
  if (tag === null) {
    return { dimTag: null, dimFavorite: false };
  }
  return parseDimItemTag(tag);
}

/** Local overrides win over DIM until the server tag matches the override. */
export function mergeDimTagMapWithLocalOverrides(
  dimTags: Record<string, DimItemTagState>,
  overrides: Record<string, LocalDimTagOverride>,
): Record<string, DimItemTagState> {
  if (Object.keys(overrides).length === 0) return dimTags;
  const merged = { ...dimTags };
  for (const [instanceId, override] of Object.entries(overrides)) {
    merged[instanceId] = dimItemTagStateFromTag(override.tag);
  }
  return merged;
}

export function applyLocalOverridesToArmorPieces(
  items: ArmorPiece[],
  overrides: Record<string, LocalDimTagOverride>,
): ArmorPiece[] {
  if (Object.keys(overrides).length === 0) return items;
  return items.map((item) => {
    const override = overrides[item.instanceId];
    if (!override) return item;
    const parsed = dimItemTagStateFromTag(override.tag);
    return {
      ...item,
      dimTag: parsed.dimTag,
      dimFavorite: parsed.dimFavorite,
    };
  });
}

/** Drop overrides once DIM reflects the same tag (write has propagated). */
export function pruneSyncedLocalOverrides(
  dimTags: Record<string, DimItemTagState>,
  overrides: Record<string, LocalDimTagOverride>,
): Record<string, LocalDimTagOverride> {
  const next: Record<string, LocalDimTagOverride> = {};
  for (const [instanceId, override] of Object.entries(overrides)) {
    const dim = dimTags[instanceId];
    if (!dim || !dimStateMatchesTag(dim, override.tag)) {
      next[instanceId] = override;
    }
  }
  return next;
}

function readAllOverrides(): OverridesByMembership {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LS_LOCAL_DIM_TAG_OVERRIDES);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as OverridesByMembership;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAllOverrides(all: OverridesByMembership): void {
  if (typeof localStorage === 'undefined') return;
  const hasAny = Object.values(all).some((m) => Object.keys(m).length > 0);
  if (!hasAny) {
    localStorage.removeItem(LS_LOCAL_DIM_TAG_OVERRIDES);
    return;
  }
  localStorage.setItem(LS_LOCAL_DIM_TAG_OVERRIDES, JSON.stringify(all));
}

export function loadLocalDimTagOverrides(
  destinyMembershipId: string,
): Record<string, LocalDimTagOverride> {
  return { ...readAllOverrides()[destinyMembershipId] };
}

export function saveLocalDimTagOverrides(
  destinyMembershipId: string,
  overrides: Record<string, LocalDimTagOverride>,
): void {
  const all = readAllOverrides();
  if (Object.keys(overrides).length === 0) {
    delete all[destinyMembershipId];
  } else {
    all[destinyMembershipId] = overrides;
  }
  writeAllOverrides(all);
}

export function recordLocalDimTagOverrides(
  destinyMembershipId: string,
  updates: { instanceId: string; tag: TagValue | null }[],
  changedAt = Date.now(),
): void {
  if (updates.length === 0) return;
  const current = loadLocalDimTagOverrides(destinyMembershipId);
  for (const { instanceId, tag } of updates) {
    current[instanceId] = { tag, changedAt };
  }
  saveLocalDimTagOverrides(destinyMembershipId, current);
}

export function clearLocalDimTagOverrides(destinyMembershipId: string): void {
  saveLocalDimTagOverrides(destinyMembershipId, {});
}
