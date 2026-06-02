import { CLASSES } from '@/lib/constants';
import type { ClassType } from '@/types';

/** Parse `/duel/:class` (and similar) route params; null if missing or invalid. */
export function parseClassRouteParam(param: string | undefined): ClassType | null {
  if (!param) return null;
  return CLASSES.includes(param as ClassType) ? (param as ClassType) : null;
}

/** Default class when the route param is absent (not when invalid). */
export function classFromRouteParam(param: string | undefined, fallback: ClassType = 'hunter'): ClassType {
  return parseClassRouteParam(param) ?? fallback;
}
