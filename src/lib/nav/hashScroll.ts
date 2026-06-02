/** In-page anchor for the combos stat-priority editor (DesiredBuildsSection). */
export const COMBOS_SECTION_ID = 'combos';

/** In-page anchor for global dupe rules on Settings. */
export const DUPE_RULES_SECTION_ID = 'dupe-rules';

export function normalizeHashTargetId(hash: string): string {
  const raw = hash.replace(/^#/, '');
  return raw === 'desired-builds' ? COMBOS_SECTION_ID : raw;
}

/** Scroll to an in-page anchor after client navigation (React Router does not). */
export function scrollToHashElement(
  hash: string,
  options?: { behavior?: ScrollBehavior; block?: ScrollLogicalPosition },
): void {
  const id = normalizeHashTargetId(hash);
  if (!id) return;
  document.getElementById(id)?.scrollIntoView({
    behavior: options?.behavior ?? 'smooth',
    block: options?.block ?? 'nearest',
  });
}

/** Restore scroll position after React state updates that shift layout. */
export function restoreScrollY(scrollY: number): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (window.scrollY !== scrollY) {
        window.scrollTo({ top: scrollY, left: 0, behavior: 'instant' });
      }
    });
  });
}
