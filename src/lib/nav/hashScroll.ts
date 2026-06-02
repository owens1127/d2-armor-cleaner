/** Scroll to an in-page anchor after client navigation (React Router does not). */
export function scrollToHashElement(hash: string): void {
  const id = hash.replace(/^#/, '');
  if (!id) return;
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
