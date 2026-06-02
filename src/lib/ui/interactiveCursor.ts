/** Documented selectors mirrored in src/index.css - used by regression test. */
export const INTERACTIVE_CURSOR_SELECTORS = [
  'button:not(:disabled)',
  'a[href]',
  "[role='button']:not([aria-disabled='true'])",
  "[role='option']",
] as const;
