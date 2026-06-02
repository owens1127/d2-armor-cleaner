import { ulid } from 'ulid';

/** Crockford base32 ULID (26 chars). */
export const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** Generate a sortable, URL-safe entity id (bare ULID, no prefix). */
export function createEntityId(): string {
  return ulid();
}

export function isUlid(value: string): boolean {
  return ULID_PATTERN.test(value);
}

/** Auto-generated build ids before reversible encoding (`build-<timestamp>-<suffix>`). */
export function isLegacyPrefixedBuildId(value: string): boolean {
  return value.startsWith('build-');
}

/** Auto-generated auto-filter ids before ULIDs (`auto-filter-<timestamp>-<suffix>`). */
export function isLegacyPrefixedAutoFilterId(value: string): boolean {
  return value.startsWith('auto-filter-');
}
