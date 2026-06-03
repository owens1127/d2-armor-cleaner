import { describe, expect, it } from 'vitest';
import { measureLoadoutPickerMenuWidthPx } from '@/components/dashboard/buildCoverageLayout';

describe('buildCoverageLayout picker', () => {
  it('measureLoadoutPickerMenuWidthPx caps to viewport and uses column width', () => {
    expect(measureLoadoutPickerMenuWidthPx(400, 800)).toBe(400);
    expect(measureLoadoutPickerMenuWidthPx(900, 500)).toBe(484);
    expect(measureLoadoutPickerMenuWidthPx(0, 600)).toBe(584);
  });
});
