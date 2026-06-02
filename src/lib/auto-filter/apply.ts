import { findAutoFilterMatches } from '@/lib/auto-filter/match';
import { useSessionStore } from '@/stores/sessionStore';
import type { ArmorPiece, AutoFilterRule } from '@/types';

/** Queue junk tags for review (auto triage - duel/compare path). */
export function applyAutoFilterRules(items: ArmorPiece[], rules: AutoFilterRule[]): number {
  const enabledRules = rules.filter((rule) => rule.enabled);
  if (enabledRules.length === 0 || items.length === 0) return 0;

  const session = useSessionStore.getState();
  const exclusions = {
    bucketJunkedIds: session.bucketJunkedIds,
    bucketKeptBothIds: session.bucketKeptBothIds,
    bucketKeptSideIds: session.bucketKeptSideIds,
    pendingTags: session.pendingTags,
  };
  const matches = findAutoFilterMatches(items, enabledRules, exclusions);
  if (matches.length === 0) return 0;

  session.junkItems(matches);
  return matches.length;
}
