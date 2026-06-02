export type CopyButtonKey = 'ids' | 'junk' | 'junk-ids';

export const COPY_BUTTON_LABELS: Record<CopyButtonKey, string> = {
  ids: 'Copy id: query',
  junk: 'Copy tag:junk search',
  'junk-ids': 'Copy junk ids only',
};

export function copyButtonAnnouncement(copied: CopyButtonKey | null): string {
  if (!copied) return '';
  return `${COPY_BUTTON_LABELS[copied]} copied to clipboard.`;
}
