import type { TagValue } from '@/types';

/**
 * DIM tag icons and labels — mirrors `tagConfig` in DIM
 * `src/app/inventory/dim-item-info.ts` and Font Awesome classes in
 * `src/app/shell/icons/Library.js`.
 *
 * SVG paths from `@fortawesome/free-solid-svg-icons@5.15.4` (same subset DIM uses).
 * Inventory tile color: `#29f36a` (`InventoryItem.m.scss` `.icon`).
 */
export const DIM_TAG_ICON_COLOR = '#29f36a';

/** Canonical green for keep / favorite in app UI (matches `--color-keep`). */
export const TAG_KEEP_COLOR = '#4ade80';

/** Canonical red for junk in app UI (matches `--color-danger`). */
export const TAG_JUNK_COLOR = '#ef4444';

/** Neutral for infuse / archive and other non keep-junk pending tags. */
export const PENDING_TAG_ICON_COLOR = '#a3a3a3';

/** DIM `.icon` size: `calc(var(--item-size) / 5)`. */
export function dimTagGlyphPx(tilePx: number): number {
  return Math.max(8, Math.round(tilePx / 5));
}

export interface DimTagDefinition {
  label: string;
  /** Font Awesome 5 Solid class used by DIM (reference only). */
  faClass: string;
  /** SVG path (Font Awesome 5 Free Solid, viewBox 0 0 512 512). */
  svgPath: string;
}

export const DIM_TAG_DEFINITIONS: Record<TagValue, DimTagDefinition> = {
  favorite: {
    label: 'Favorite',
    faClass: 'fas fa-heart',
    svgPath:
      'M462.3 62.6C407.5 15.9 326 24.3 275.7 76.2L256 96.5l-19.7-20.3C186.1 24.3 104.5 15.9 49.7 62.6c-62.8 53.6-66.1 149.8-9.9 207.9l193.5 199.8c12.5 12.9 32.8 12.9 45.3 0l193.5-199.8c56.3-58.1 53-154.3-9.8-207.9z',
  },
  keep: {
    label: 'Keep',
    faClass: 'fas fa-tag',
    svgPath:
      'M0 252.118V48C0 21.49 21.49 0 48 0h204.118a48 48 0 0 1 33.941 14.059l211.882 211.882c18.745 18.745 18.745 49.137 0 67.882L293.823 497.941c-18.745 18.745-49.137 18.745-67.882 0L14.059 286.059A48 48 0 0 1 0 252.118zM112 64c-26.51 0-48 21.49-48 48s21.49 48 48 48 48-21.49 48-48-21.49-48-48-48z',
  },
  junk: {
    label: 'Junk',
    faClass: 'fas fa-ban',
    svgPath:
      'M256 8C119.034 8 8 119.033 8 256s111.034 248 248 248 248-111.034 248-248S392.967 8 256 8zm130.108 117.892c65.448 65.448 70 165.481 20.677 235.637L150.47 105.216c70.204-49.356 170.226-44.735 235.638 20.676zM125.892 386.108c-65.448-65.448-70-165.481-20.677-235.637L361.53 406.784c-70.203 49.356-170.226 44.736-235.638-20.676z',
  },
  infuse: {
    label: 'Infuse',
    faClass: 'fas fa-bolt',
    svgPath:
      'M296 160H180.6l42.6-129.8C227.2 15 215.7 0 200 0H56C44 0 33.8 8.9 32.2 20.8l-32 240C-1.7 275.2 9.5 288 24 288h118.7L96.6 482.5c-3.6 15.2 8 29.5 23.3 29.5 8.4 0 16.4-4.4 20.8-12l176-304c9.3-15.9-2.2-36-20.7-36z',
  },
  archive: {
    label: 'Archive',
    faClass: 'fas fa-archive',
    svgPath:
      'M32 448c0 17.7 14.3 32 32 32h384c17.7 0 32-14.3 32-32V160H32v288zm160-212c0-6.6 5.4-12 12-12h104c6.6 0 12 5.4 12 12v8c0 6.6-5.4 12-12 12H204c-6.6 0-12-5.4-12-12v-8zM480 32H32C14.3 32 0 46.3 0 64v48c0 8.8 7.2 16 16 16h480c8.8 0 16-7.2 16-16V64c0-17.7-14.3-32-32-32z',
  },
};

export function dimTagLabel(tag: TagValue): string {
  return DIM_TAG_DEFINITIONS[tag].label;
}

export interface ReviewTagPresentation {
  label: string;
  color: string;
}

function isKeepFamilyTag(tag: TagValue): boolean {
  return tag === 'keep' || tag === 'favorite';
}

/** Icon / inline text color for a tag glyph (pending review or DIM overlay). */
export function tagIconColor(tag: TagValue, source: 'dim' | 'pending'): string {
  if (source === 'dim') return DIM_TAG_ICON_COLOR;
  if (isKeepFamilyTag(tag)) return TAG_KEEP_COLOR;
  if (tag === 'junk') return TAG_JUNK_COLOR;
  return PENDING_TAG_ICON_COLOR;
}

/** Canonical review row label + color mapping (no status prefixes). */
export function reviewTagPresentation(tag: TagValue): ReviewTagPresentation {
  return {
    label: dimTagLabel(tag),
    color: tagIconColor(tag, 'pending'),
  };
}

/** Human-readable list of tags already on the item in DIM (favorite + primary tag). */
export function formatDimTagSummary(
  dimTag?: TagValue | null,
  dimFavorite?: boolean,
): string | null {
  const parts: string[] = [];
  if (dimFavorite || dimTag === 'favorite') {
    parts.push(dimTagLabel('favorite'));
  }
  if (dimTag && dimTag !== 'favorite') {
    parts.push(dimTagLabel(dimTag));
  }
  return parts.length > 0 ? parts.join(', ') : null;
}

export function tagIndicatorTitle(tag: TagValue, source: 'dim' | 'pending'): string {
  const label = dimTagLabel(tag);
  return source === 'dim' ? `${label} (DIM)` : `${label} (pending review)`;
}

export type TagActionKind = 'keep' | 'favorite' | 'junk';

/** SVG glyph size inside `.ui-icon-btn` tag actions (combos, loadout rows). */
export const TAG_ACTION_GLYPH_PX = 16;

const tagActionIconBtnBase = 'ui-icon-btn rounded border shrink-0 transition-colors';

const tagActionIconBtnDisabled =
  'disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed';

/** Shared active / inactive classes — keep and favorite use the same green treatment. */
export const TAG_ACTION_ICON_BTN = {
  keepFamily: {
    active: `${tagActionIconBtnBase} cursor-pointer border-keep/45 bg-keep/15 text-keep hover:bg-keep/20`,
    activeLocked: `${tagActionIconBtnBase} border-keep/45 bg-keep/15 text-keep pointer-events-none cursor-default`,
    inactive: `${tagActionIconBtnBase} cursor-pointer border-border text-keep/70 hover:text-keep hover:border-keep/30 hover:bg-keep/5 ${tagActionIconBtnDisabled}`,
  },
  junk: {
    active: `${tagActionIconBtnBase} cursor-pointer border-danger/45 bg-danger/15 text-danger hover:bg-danger/20`,
    activeLocked: `${tagActionIconBtnBase} border-danger/45 bg-danger/15 text-danger pointer-events-none cursor-default`,
    inactive: `${tagActionIconBtnBase} cursor-pointer border-border text-danger/70 hover:text-danger hover:border-danger/30 hover:bg-danger/5 ${tagActionIconBtnDisabled}`,
  },
} as const;

export function tagActionKeepActive(
  piece: Pick<{ dimTag?: TagValue | null }, 'dimTag'>,
): boolean {
  return piece.dimTag === 'keep';
}

export function tagActionFavoriteActive(
  piece: Pick<{ dimTag?: TagValue | null; dimFavorite?: boolean }, 'dimTag' | 'dimFavorite'>,
): boolean {
  return piece.dimFavorite === true || piece.dimTag === 'favorite';
}

export function tagActionJunkActive(
  piece: Pick<{ dimTag?: TagValue | null }, 'dimTag'>,
): boolean {
  return piece.dimTag === 'junk';
}

/** Compact icon-only keep / favorite / junk buttons (combos picker, loadout rows). */
export function tagActionIconBtnClass(
  tag: TagActionKind,
  active: boolean,
  options?: { locked?: boolean },
): string {
  if (tag === 'junk') {
    if (!active) return TAG_ACTION_ICON_BTN.junk.inactive;
    return options?.locked
      ? TAG_ACTION_ICON_BTN.junk.activeLocked
      : TAG_ACTION_ICON_BTN.junk.active;
  }
  if (!active) return TAG_ACTION_ICON_BTN.keepFamily.inactive;
  return options?.locked
    ? TAG_ACTION_ICON_BTN.keepFamily.activeLocked
    : TAG_ACTION_ICON_BTN.keepFamily.active;
}

/** Text keep / junk action buttons on dashboard bucket cards. */
export const tagKeepBtnClass =
  'text-xs py-2 px-3 min-h-[2.25rem] rounded-md transition-colors font-medium text-keep/85 hover:text-keep border border-keep/25 hover:border-keep/40 bg-keep/[0.06] hover:bg-keep/10';
export const tagKeepBtnActiveClass =
  'text-xs py-2 px-3 min-h-[2.25rem] rounded-md transition-colors font-medium text-keep border border-keep/45 bg-keep/15 hover:bg-keep/20';

export const tagJunkBtnClass =
  'text-xs py-2 px-3 min-h-[2.25rem] rounded-md transition-colors font-medium text-danger/85 hover:text-danger border border-danger/25 hover:border-danger/40 bg-danger/[0.06] hover:bg-danger/10';
export const tagJunkBtnActiveClass =
  'text-xs py-2 px-3 min-h-[2.25rem] rounded-md transition-colors font-medium text-danger border border-danger/45 bg-danger/15 hover:bg-danger/20';

/** Duel compare keep / junk action buttons (append to shared actionBtnBase). */
export function tagKeepDuelBtnClass(actionBtnBase: string): string {
  return `${actionBtnBase} text-keep hover:text-keep border border-keep/25 hover:border-keep/40 bg-keep/[0.06] hover:bg-keep/10`;
}

export function tagKeepBothDuelBtnClass(actionBtnBase: string): string {
  return `${actionBtnBase} text-keep hover:text-keep border border-dashed border-keep/30 hover:border-keep/45 bg-keep/[0.04] hover:bg-keep/08`;
}

export function tagJunkDuelBtnClass(actionBtnBase: string): string {
  return `${actionBtnBase} text-danger/85 hover:text-danger border border-danger/25 hover:border-danger/40 bg-danger/[0.06] hover:bg-danger/10`;
}

export function tagJunkBothDuelBtnClass(actionBtnBase: string): string {
  return `${actionBtnBase} text-danger hover:text-danger border border-dashed border-danger/35 hover:border-danger/50 bg-danger/[0.06] hover:bg-danger/12`;
}

/** Browse grid inline keep / junk links. */
export function tagKeepLinkClass(active: boolean): string {
  return `text-xs py-1 px-0.5 min-h-[2rem] inline-flex items-center hover:text-keep ${active ? 'text-keep' : 'text-keep/80'}`;
}

export function tagJunkLinkClass(active: boolean): string {
  return `text-xs py-1 px-0.5 min-h-[2rem] inline-flex items-center hover:text-danger ${active ? 'text-danger' : 'text-danger/80'}`;
}
