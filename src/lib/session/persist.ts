import type { ClassType, PendingTag } from '@/types';
import { dimInstanceIdsQuery } from '@/lib/dim/query';
import { LS_CLEAN_SESSION, SS_CLEAN_SESSION } from '@/lib/storage/keys';
import { inferCleanClassType } from '@/lib/session/cleanSession';

export interface PersistedSession {
  cleanClassType?: ClassType | null;
  activeNavClass?: ClassType;
  /** @deprecated Tags live in localStorage (`dac-review-tags`); read only for migration. */
  pendingTags?: PendingTag[];
  duelQueue: string[];
  bucketJunkedIds: string[];
  /** Tournament losers excluded from bracket until leaving the current duplicate group. */
  bucketEliminatedIds?: string[];
  /** Prefer loss counts this bucket (double elimination before bucketEliminatedIds). */
  bucketLossCounts?: Record<string, number>;
  bucketKeptBothIds: string[];
  /** Keep-one-side picks — stay in duels; protected from tournament auto-junk when advancing. */
  bucketKeptSideIds?: string[];
  /** Current tournament champion within the active duplicate group (survives remount). */
  bucketChampionId?: string | null;
  /** Remaining challengers in tournament order within the active duplicate group. */
  bucketChallengerIds?: string[];
  /** Sorted instance-id pair keys for duels already acted on in the current group. */
  actedPairKeys?: string[];
  /** @deprecated Renamed to actedPairKeys. */
  bucketResolvedPairKeys?: string[];
}

function migrateCleanSessionFromSessionStorage(): void {
  if (typeof localStorage === 'undefined' || typeof sessionStorage === 'undefined') return;
  if (localStorage.getItem(LS_CLEAN_SESSION) != null) return;
  const fromSession =
    sessionStorage.getItem(SS_CLEAN_SESSION) ?? sessionStorage.getItem(LS_CLEAN_SESSION);
  if (fromSession != null) {
    localStorage.setItem(LS_CLEAN_SESSION, fromSession);
  }
}

export function loadPersistedSession(): PersistedSession | null {
  try {
    migrateCleanSessionFromSessionStorage();
    const raw = localStorage.getItem(LS_CLEAN_SESSION);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    const normalized: PersistedSession = {
      ...parsed,
      bucketKeptBothIds: parsed.bucketKeptBothIds ?? [],
      bucketKeptSideIds: parsed.bucketKeptSideIds ?? [],
      bucketEliminatedIds: parsed.bucketEliminatedIds ?? [],
      bucketLossCounts: parsed.bucketLossCounts ?? {},
      bucketChampionId: parsed.bucketChampionId ?? null,
      bucketChallengerIds: parsed.bucketChallengerIds ?? [],
      actedPairKeys: parsed.actedPairKeys ?? parsed.bucketResolvedPairKeys ?? [],
    };
    return {
      ...normalized,
      cleanClassType: parsed.cleanClassType ?? inferCleanClassType(normalized),
      activeNavClass:
        parsed.activeNavClass ??
        parsed.cleanClassType ??
        inferCleanClassType(normalized) ??
        'hunter',
    };
  } catch {
    return null;
  }
}

export function savePersistedSession(data: PersistedSession): void {
  localStorage.setItem(LS_CLEAN_SESSION, JSON.stringify(data));
}

export function clearPersistedSession(): void {
  localStorage.removeItem(LS_CLEAN_SESSION);
  sessionStorage.removeItem(SS_CLEAN_SESSION);
}

export function dimIdQuery(tags: PendingTag[]): string {
  return dimInstanceIdsQuery(tags.map((t) => t.instanceId));
}

export function dimJunkSearchQuery(classType?: string): string {
  return classType ? `tag:junk is:${classType}` : 'tag:junk';
}
