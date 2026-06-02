import { describe, expect, it } from 'vitest';
import { COMBOS_SECTION_ID, normalizeHashTargetId } from '@/lib/nav/hashScroll';

describe('normalizeHashTargetId', () => {
  it('maps legacy desired-builds hash to combos', () => {
    expect(normalizeHashTargetId('#desired-builds')).toBe(COMBOS_SECTION_ID);
    expect(normalizeHashTargetId('desired-builds')).toBe(COMBOS_SECTION_ID);
  });

  it('strips leading hash', () => {
    expect(normalizeHashTargetId('#combos')).toBe('combos');
  });
});
