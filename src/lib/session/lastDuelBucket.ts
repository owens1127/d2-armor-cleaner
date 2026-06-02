import type { ClassType } from '@/types';

const PREFIX = 'dac-last-duel-bucket:';

function storageKey(classType: ClassType): string {
  return `${PREFIX}${classType}`;
}

/** Last compare bucket chosen for this class (survives reload; not a source of truth vs URL). */
export function getLastDuelBucketKey(classType: ClassType): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(classType));
    return raw && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

export function setLastDuelBucketKey(classType: ClassType, bucketKey: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(storageKey(classType), bucketKey);
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearLastDuelBucketKey(classType: ClassType): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(storageKey(classType));
  } catch {
    /* ignore */
  }
}
