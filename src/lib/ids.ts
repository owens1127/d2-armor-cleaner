import { ulid } from 'ulid';

/** Generate a sortable, URL-safe entity id (bare ULID, no prefix). */
export function createEntityId(): string {
  return ulid();
}
