import { i18n } from '@/i18n';
import { DUEL_KEY_LABELS } from '@/lib/duel/keyboard';
import { matchingBuildNames } from '@/lib/coverage/buildOptimal';
import type { ArmorPiece, ClassPreferenceProfile } from '@/types';

export type DuelKeyId = keyof typeof DUEL_KEY_LABELS;

/** Keyboard shortcut labels (not translated). */
export function duelKeyLabelCopy(key: DuelKeyId): string {
  return DUEL_KEY_LABELS[key];
}

export function duelIdenticalRollsBannerCopy(): string {
  return i18n.t('duel:compare.identicalRolls');
}

export function duelSuppressedSuggestionBannerCopy(): string {
  return i18n.t('duel:compare.suppressedSuggestion');
}

export function formatDuelSuggestionBuildOptimalReason(
  piece: ArmorPiece,
  prefs: ClassPreferenceProfile,
): string | undefined {
  const names = matchingBuildNames(piece, prefs);
  if (names.length === 0) return undefined;
  return `${i18n.t('duel:compare.buildOptimalPrefix')}${names.join(', ')}`;
}

export function formatWrapUpSessionContext(groupsRemainingAfterCurrent: number): string {
  if (groupsRemainingAfterCurrent === 0) {
    return i18n.t('duel:wrapUp.sessionLast');
  }
  return i18n.t('duel:wrapUp.sessionLeft', { count: groupsRemainingAfterCurrent });
}
