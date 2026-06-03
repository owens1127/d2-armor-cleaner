import { i18n } from '@/i18n';
import { dimInstanceIdQuery, dimInstanceIdsQuery } from '@/lib/dim/query';

export function copyDimQueryAriaLabel(itemName: string): string {
  return i18n.t('common:dimCopy.queryFor', { name: itemName });
}

export function copyDimQueryAnnouncement(itemName: string): string {
  return i18n.t('common:dimCopy.queryCopied', { name: itemName });
}

export async function copyDimQueryForInstance(
  instanceId: string,
  writeText: (text: string) => Promise<void>,
): Promise<string> {
  const query = dimInstanceIdQuery(instanceId);
  await writeText(query);
  return query;
}

export function copyDimQueriesAriaLabel(_pieceCount: number): string {
  return i18n.t('common:dimCopy.searchShown');
}

export function copyDimQueriesGroupAriaLabel(pieceCount: number): string {
  return i18n.t('common:dimCopy.searchGroup', { count: pieceCount });
}

export function copyDimQueriesAnnouncement(_pieceCount: number): string {
  return i18n.t('common:dimCopy.searchShownCopied');
}

export function copyDimQueriesGroupAnnouncement(pieceCount: number): string {
  return i18n.t('common:dimCopy.searchGroupCopied', { count: pieceCount });
}

export async function copyDimQueriesForInstances(
  instanceIds: readonly string[],
  writeText: (text: string) => Promise<void>,
): Promise<string> {
  const query = dimInstanceIdsQuery(instanceIds);
  await writeText(query);
  return query;
}
