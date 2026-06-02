import { bungieFetch } from './client';
import type { BungieMembership } from '@/types';

let sessionMembership: BungieMembership | null = null;

export function primeMembershipCache(m: BungieMembership): void {
  sessionMembership = m;
}

export function clearMembershipCache(): void {
  sessionMembership = null;
}

interface MembershipResponse {
  bungieNetUser: { membershipId: string };
  destinyMemberships: {
    membershipType: number;
    membershipId: string;
    displayName: string;
    bungieGlobalDisplayName?: string;
  }[];
  primaryMembershipId: string | null;
}

export async function resolveDestinyMembership(
  force = false,
): Promise<BungieMembership> {
  if (!force && sessionMembership) return sessionMembership;

  const data = await bungieFetch<MembershipResponse>(
    '/Platform/User/GetMembershipsForCurrentUser/',
  );

  const primary =
    data.destinyMemberships.find((m) => m.membershipId === data.primaryMembershipId) ??
    data.destinyMemberships[0];

  if (!primary) throw new Error('No Destiny 2 membership found on this Bungie account');

  sessionMembership = {
    bungieMembershipId: data.bungieNetUser.membershipId,
    destinyMembershipId: primary.membershipId,
    membershipType: primary.membershipType,
    displayName:
      primary.bungieGlobalDisplayName ??
      primary.displayName ??
      'Guardian',
  };
  return sessionMembership;
}
