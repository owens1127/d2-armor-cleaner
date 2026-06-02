import { dimInstanceIdQuery, dimInstanceIdsQuery } from '@/lib/dim/query';

export function copyDimQueryAriaLabel(itemName: string): string {
  return `Copy DIM query for ${itemName}`;
}

export function copyDimQueryAnnouncement(itemName: string): string {
  return `${copyDimQueryAriaLabel(itemName)} copied to clipboard.`;
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
  return 'Copy DIM search for shown pieces';
}

export function copyDimQueriesGroupAriaLabel(pieceCount: number): string {
  return `Copy DIM search for all ${pieceCount} piece${pieceCount === 1 ? '' : 's'} in this group`;
}

export function copyDimQueriesAnnouncement(pieceCount: number): string {
  return `${copyDimQueriesAriaLabel(pieceCount)} copied to clipboard.`;
}

export function copyDimQueriesGroupAnnouncement(pieceCount: number): string {
  return `${copyDimQueriesGroupAriaLabel(pieceCount)} copied to clipboard.`;
}

export async function copyDimQueriesForInstances(
  instanceIds: readonly string[],
  writeText: (text: string) => Promise<void>,
): Promise<string> {
  const query = dimInstanceIdsQuery(instanceIds);
  await writeText(query);
  return query;
}
