import { i18n } from '@/i18n';

export type CopyButtonKey = 'ids' | 'junk' | 'junk-ids';

const COPY_KEYS: Record<CopyButtonKey, string> = {
  ids: 'review:copy.ids',
  junk: 'review:copy.junk',
  'junk-ids': 'review:copy.junkIds',
};

export function copyButtonLabel(key: CopyButtonKey): string {
  return i18n.t(COPY_KEYS[key] as 'review:copy.ids');
}

export function copyButtonAnnouncement(copied: CopyButtonKey | null): string {
  if (!copied) return '';
  return i18n.t('review:copy.announcement', { label: copyButtonLabel(copied) });
}
