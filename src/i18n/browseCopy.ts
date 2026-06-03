import { i18n } from '@/i18n';
import type { BrowseSortOrder } from '@/lib/armor/sort';

export function browseSortLabelCopy(order: BrowseSortOrder): string {
  if (order === 'match-desc') return i18n.t('browse:sort.matchDescHint');
  if (order === 'match-asc') return i18n.t('browse:sort.matchAscHint');
  if (order === 'build-fit-desc') return i18n.t('browse:sort.buildFitHint');
  return i18n.t('browse:sort.preferenceHint');
}
