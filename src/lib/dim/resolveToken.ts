import { getBungieAuthItem } from '@/lib/bungie/authStorage';
import { getBungieAccessToken } from '@/lib/bungie/client';
import { exchangeDimToken } from '@/lib/dim/auth';
import { isDimConfigured } from '@/lib/dim/tags';
import { dimSyncUnavailableMessage } from '@/lib/env';
import { SS_DIM_TOKEN } from '@/lib/storage/keys';
import type { BungieMembership } from '@/types';

export async function resolveDimToken(membership: BungieMembership): Promise<string> {
  const cached = getBungieAuthItem(SS_DIM_TOKEN);
  if (cached) return cached;

  if (!isDimConfigured()) {
    throw new Error(dimSyncUnavailableMessage());
  }

  const bungieToken = getBungieAccessToken();
  if (!bungieToken) throw new Error('Bungie session expired: sign in again');

  return exchangeDimToken(bungieToken, membership.bungieMembershipId);
}
