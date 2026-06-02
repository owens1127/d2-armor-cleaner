import { dimSyncUnavailableMessage, getDimApiKey } from '@/lib/env';
import { setBungieAuthItem } from '@/lib/bungie/authStorage';
import {
  parseDimTagsFromAnnotations,
  type DimItemTagState,
} from '@/lib/dim/parseTags';
import { SS_DIM_TOKEN } from '@/lib/storage/keys';

const DIM_API = 'https://api.destinyitemmanager.com';

export async function exchangeDimToken(
  bungieAccessToken: string,
  bungieMembershipId: string,
): Promise<string> {
  const apiKey = getDimApiKey();
  if (!apiKey) throw new Error(dimSyncUnavailableMessage());

  const res = await fetch(`${DIM_API}/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      bungieAccessToken,
      membershipId: bungieMembershipId,
    }),
  });

  if (!res.ok) throw new Error(`DIM auth failed: ${res.status}`);
  const json = await res.json();
  setBungieAuthItem(SS_DIM_TOKEN, json.accessToken);
  return json.accessToken as string;
}

export async function fetchDimTags(
  dimToken: string,
  platformMembershipId: string,
): Promise<Record<string, DimItemTagState>> {
  const apiKey = getDimApiKey();
  if (!apiKey) return {};

  const res = await fetch(
    `${DIM_API}/profile?platformMembershipId=${platformMembershipId}&components=tags`,
    {
      headers: {
        Authorization: `Bearer ${dimToken}`,
        'X-API-Key': apiKey,
      },
    },
  );

  if (!res.ok) return {};
  const json = await res.json();
  return parseDimTagsFromAnnotations(json.tags);
}
