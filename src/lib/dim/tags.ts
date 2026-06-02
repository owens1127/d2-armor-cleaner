import { getDimApiKey } from '@/lib/env';
import type { TagValue } from '@/types';

const DIM_API = 'https://api.destinyitemmanager.com';

export { getDimApiKey };

export function isDimConfigured(): boolean {
  return Boolean(getDimApiKey());
}

export interface DimTagApplyResult {
  instanceId: string;
  ok: boolean;
  error?: string;
}

export interface DimApplySummary {
  applied: DimTagApplyResult[];
  allOk: boolean;
}

export async function applyDimTags(
  platformMembershipId: string,
  dimToken: string,
  tags: { instanceId: string; tag: TagValue | null }[],
): Promise<DimApplySummary> {
  const apiKey = getDimApiKey();
  if (!apiKey) throw new Error('DIM API key not configured');

  const res = await fetch(`${DIM_API}/profile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${dimToken}`,
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      platformMembershipId,
      destinyVersion: 2,
      updates: tags.map(({ instanceId, tag }) => ({
        action: 'tag',
        payload: { id: instanceId, tag },
      })),
    }),
  });

  if (!res.ok) throw new Error(`DIM API error: ${res.status}`);
  const json = await res.json();
  const rawResults: { status?: string; payload?: { id?: string }; error?: string }[] =
    json.results ?? [];

  const applied: DimTagApplyResult[] = tags.map((t, i) => {
    const r = rawResults[i];
    const ok = r?.status === 'Success';
    return {
      instanceId: t.instanceId,
      ok,
      error: ok ? undefined : (r?.error ?? r?.status ?? 'Unknown error'),
    };
  });

  return { applied, allOk: applied.every((r) => r.ok) };
}
