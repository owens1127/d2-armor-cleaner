import { describe, expect, it } from 'vitest';
import {
  measureLoadoutPickerMenuWidthPx,
  rollPatternPickerActionRailStyle,
  rollPatternPickerSlotRowInnerStyle,
} from '@/components/dashboard/buildCoverageLayout';

describe('buildCoverageLayout picker', () => {
  it('picker row grid uses 4-button rail track, not full 5-slot rail', () => {
    expect(rollPatternPickerSlotRowInnerStyle().gridTemplateColumns).toContain(
      '--loadout-picker-action-rail',
    );
    expect(rollPatternPickerSlotRowInnerStyle().gridTemplateColumns).not.toContain(
      '--loadout-action-rail',
    );
  });

  it('picker action rail has four columns only', () => {
    expect(rollPatternPickerActionRailStyle().gridTemplateColumns).toBe(
      'repeat(4, var(--spacing-touch-sm))',
    );
  });

  it('measureLoadoutPickerMenuWidthPx caps to viewport and uses column width', () => {
    expect(measureLoadoutPickerMenuWidthPx(400, 800)).toBe(400);
    expect(measureLoadoutPickerMenuWidthPx(900, 500)).toBe(484);
    expect(measureLoadoutPickerMenuWidthPx(0, 600)).toBe(584);
  });
});
