import { useMemo, type ReactNode } from 'react';
import { PendingTagsContext } from '@/components/items/pendingTagsContext';
import { normalizePendingTags } from '@/lib/session/reviewTags';
import { useSessionStore } from '@/stores/sessionStore';
import type { TagValue } from '@/types';

export function PendingTagsProvider({ children }: { children: ReactNode }) {
  const pendingTags = useSessionStore((s) => s.pendingTags);
  const byInstanceId = useMemo(() => {
    const map = new Map<string, TagValue>();
    for (const t of normalizePendingTags(pendingTags)) {
      if (t.tag) map.set(t.instanceId, t.tag);
    }
    return map;
  }, [pendingTags]);

  return (
    <PendingTagsContext.Provider value={byInstanceId}>{children}</PendingTagsContext.Provider>
  );
}
