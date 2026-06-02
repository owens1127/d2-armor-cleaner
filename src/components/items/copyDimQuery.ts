import { dimInstanceIdQuery } from '@/lib/dim/query';

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
