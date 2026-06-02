/** DIM search filter for a single item instance. */
export function dimInstanceIdQuery(instanceId: string): string {
  return `id:${instanceId}`;
}

/** DIM search filter for multiple item instances (OR-combined). */
export function dimInstanceIdsQuery(instanceIds: readonly string[]): string {
  return instanceIds.map(dimInstanceIdQuery).join(' or ');
}
