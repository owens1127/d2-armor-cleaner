export const COVERAGE_COLUMN_LAYOUT_KEY = 'd2ac.coverage.columnLayout';

export type CoverageColumnLayout = 'split' | 'group';

export function readCoverageColumnLayout(): CoverageColumnLayout {
  if (typeof localStorage === 'undefined') return 'split';
  const stored = localStorage.getItem(COVERAGE_COLUMN_LAYOUT_KEY);
  return stored === 'group' ? 'group' : 'split';
}

export function writeCoverageColumnLayout(layout: CoverageColumnLayout): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(COVERAGE_COLUMN_LAYOUT_KEY, layout);
}
