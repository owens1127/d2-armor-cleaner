import { getBungieAuthItem } from '@/lib/bungie/authStorage';
import { getBungieAccessToken } from '@/lib/bungie/client';
import { exchangeDimToken } from '@/lib/dim/auth';
import { isDimConfigured } from '@/lib/dim/tags';
import { DIM_API_KEY_ENV } from '@/lib/env';
import { SS_DIM_TOKEN } from '@/lib/storage/keys';
import type { BungieMembership } from '@/types';

export async function resolveDimToken(membership: BungieMembership): Promise<string> {
  const cached = getBungieAuthItem(SS_DIM_TOKEN);
  if (cached) return cached;

  if (!isDimConfigured()) {
    throw new Error(`Add ${DIM_API_KEY_ENV} to .env (see Settings for instructions)`);
  }

  const bungieToken = getBungieAccessToken();
  if (!bungieToken) throw new Error('Bungie session expired: sign in again');

  return exchangeDimToken(bungieToken, membership.bungieMembershipId);
}
