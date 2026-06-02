export function moveRankedItem<T>(items: T[], index: number, dir: -1 | 1): T[] | null {
  const target = index + dir;
  if (index < 0 || index >= items.length) return null;
  if (target < 0 || target >= items.length) return null;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function reorderRankedItems<T>(items: T[], sourceIndex: number, targetIndex: number): T[] {
  if (sourceIndex < 0 || sourceIndex >= items.length) return items;
  if (targetIndex < 0 || targetIndex >= items.length) return items;
  if (sourceIndex === targetIndex) return items;
  const next = [...items];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}
