import { describe, expect, it } from 'vitest';
import { armorPiece } from '@/test/armorFixtures';
import type { DismantleCandidate } from '@/lib/dupes/dismantle';
import { formatRedundantReasonLine, redundantReasonBadge } from '@/lib/browse/redundantReason';

describe('formatRedundantReasonLine', () => {
  it('describes stat-lower vs keeper with beat summary', () => {
    const peer = armorPiece({
      instanceId: 'peer',
      name: 'Peer Vest',
      baseStats: { weapons: 30, grenade: 25, super: 20 },
    });
    const item = armorPiece({
      instanceId: 'cand',
      name: 'Weak Vest',
      baseStats: { weapons: 25, grenade: 25, super: 20 },
    });
    const candidate: DismantleCandidate = {
      item,
      peer,
      reason: 'stat-lower',
      dominatorResult: {
        dominator: peer,
        beatsOn: [{ stat: 'weapons', delta: 5 }],
      },
    };
    expect(formatRedundantReasonLine(candidate)).toBe(
      'Strictly lower than Peer Vest · Weapons +5',
    );
    expect(redundantReasonBadge(candidate.reason)).toBe('Strictly lower');
  });

  it('describes tuning-duplicate with mutual coverage', () => {
    const peer = armorPiece({ instanceId: 'peer', name: 'Keeper Helm' });
    const item = armorPiece({ instanceId: 'cand', name: 'Dup Helm' });
    const candidate: DismantleCandidate = {
      item,
      peer,
      reason: 'tuning-duplicate',
      tuningCoverage: { peer, mutual: true },
    };
    expect(formatRedundantReasonLine(candidate)).toContain('Keeper Helm');
    expect(formatRedundantReasonLine(candidate)).toContain('keep one');
    expect(redundantReasonBadge(candidate.reason)).toBe('Tuning duplicate');
  });
});
