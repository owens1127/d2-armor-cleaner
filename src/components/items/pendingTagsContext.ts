import { createContext, useContext } from 'react';
import type { TagValue } from '@/types';

export const PendingTagsContext = createContext<ReadonlyMap<string, TagValue>>(new Map());

export function usePendingTagForInstance(instanceId: string): TagValue | null {
  return useContext(PendingTagsContext).get(instanceId) ?? null;
}
