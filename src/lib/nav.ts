import { CLASSES } from '@/lib/constants';
import { decodeBuildId } from '@/lib/coverage/buildIdCodec';
import {
  getCalibrateNavPath,
  getOnboardingResumePath,
  hasInProgressOnboarding,
  isOnboardingComplete,
} from '@/lib/onboarding/storage';
import type { ClassType, DesiredBuild } from '@/types';

export type ClassRouteSegment = 'dashboard' | 'browse' | 'combos' | 'duel' | 'dismantle';

export function navClassFromPath(pathname: string): ClassType | null {
  const match = pathname.match(
    /\/(?:dashboard|browse|combos|duel|dismantle)\/(titan|hunter|warlock)/,
  );
  if (match && CLASSES.includes(match[1] as ClassType)) {
    return match[1] as ClassType;
  }
  return null;
}

export function navClassFromSearch(search: string): ClassType | null {
  const value = new URLSearchParams(search).get('class');
  if (value && CLASSES.includes(value as ClassType)) {
    return value as ClassType;
  }
  return null;
}

export function resolveActiveNavClass(pathname: string, search: string, stored: ClassType): ClassType {
  return navClassFromPath(pathname) ?? navClassFromSearch(search) ?? stored;
}

const CLASS_PATH_SEGMENT_RE =
  /^\/(dashboard|browse|combos|duel|dismantle)\/(titan|hunter|warlock)$/;

/**
 * Target path when switching guardian class from the header picker.
 * Returns null on class-agnostic routes (review, settings, home, etc.) — caller
 * should update session activeNavClass only, without navigating.
 */
export function classSwitchPath(
  pathname: string,
  search: string,
  hash: string,
  newClass: ClassType,
): string | null {
  if (CLASS_PATH_SEGMENT_RE.test(pathname)) {
    const segment = pathname.split('/')[1]!;
    return `/${segment}/${newClass}${search}${hash}`;
  }

  const legacyClean = pathname.match(/^\/clean\/(?:titan|hunter|warlock)$/);
  if (legacyClean) {
    return `/duel/${newClass}${search}${hash}`;
  }

  const legacyBuild = pathname.match(/^\/build\/(?:titan|hunter|warlock)$/);
  if (legacyBuild) {
    const normalizedHash = hash === '#desired-builds' ? '#combos' : hash;
    return `/combos/${newClass}${search}${normalizedHash}`;
  }

  if (pathname === '/onboarding/calibrate') {
    const params = new URLSearchParams(search);
    params.set('class', newClass);
    const query = params.toString();
    return `/onboarding/calibrate${query ? `?${query}` : ''}${hash}`;
  }

  return null;
}

export type AppNavItem = {
  label: string;
  match: string;
  to: string;
};

/** Post-login landing: class dashboard or resume onboarding. */
export function authenticatedLandingPath(activeClass: ClassType): string {
  const complete = isOnboardingComplete();
  if (complete && !hasInProgressOnboarding()) {
    return `/dashboard/${activeClass}`;
  }
  return getOnboardingResumePath(complete);
}

export function buildAuthenticatedNavLinks(activeClass: ClassType): AppNavItem[] {
  return [
    { label: 'Dashboard', match: '/dashboard', to: `/dashboard/${activeClass}` },
    { label: 'Calibrate', match: '/onboarding', to: getCalibrateNavPath(activeClass) },
    { label: 'Browse', match: '/browse', to: `/browse/${activeClass}` },
    { label: 'Combos', match: '/combos', to: `/combos/${activeClass}` },
    { label: 'Compare', match: '/duel', to: `/duel/${activeClass}` },
    { label: 'Review', match: '/review', to: '/review' },
    { label: 'Auto filters', match: '/auto-filters', to: '/auto-filters' },
    { label: 'Settings', match: '/settings', to: '/settings' },
  ];
}

export function signedOutNavLinks(): AppNavItem[] {
  return [];
}

export function isNavLinkActive(pathname: string, item: AppNavItem): boolean {
  return pathname.startsWith(item.match);
}

/** Query param for active combo on Combos and Browse pages. */
export const BUILD_QUERY_PARAM = 'build';

function isValidBuildParam(
  buildParam: string,
  classType: ClassType,
  builds: readonly Pick<DesiredBuild, 'id' | 'legacyId' | 'enabled'>[],
): boolean {
  const enabled = builds.filter((b) => b.enabled !== false);
  if (enabled.some((b) => b.id === buildParam || b.legacyId === buildParam)) return true;
  const decoded = decodeBuildId(buildParam);
  return decoded !== null && decoded.classType === classType;
}

/** Pick the active combo id from the URL, falling back to the first enabled combo. */
export function resolveCombosBuildId(
  buildParam: string | null,
  builds: readonly Pick<DesiredBuild, 'id' | 'legacyId' | 'enabled'>[],
  classType: ClassType,
): string {
  const enabled = builds.filter((b) => b.enabled !== false);
  if (buildParam && isValidBuildParam(buildParam, classType, builds)) {
    const direct = enabled.find((b) => b.id === buildParam);
    if (direct) return direct.id;
    const legacy = enabled.find((b) => b.legacyId === buildParam);
    if (legacy) return legacy.id;
    return buildParam;
  }
  if (enabled.length === 0) return '';
  return enabled[0]!.id;
}

/** Combos page path with optional active combo and hash (e.g. `#combos` editor). */
export function combosPagePath(
  classType: ClassType,
  options?: { buildId?: string; hash?: string },
): string {
  const params = new URLSearchParams();
  if (options?.buildId) {
    params.set(BUILD_QUERY_PARAM, options.buildId);
  }
  const query = params.toString();
  const hash = options?.hash ?? '';
  return `/combos/${classType}${query ? `?${query}` : ''}${hash}`;
}

/** Deep link to stat-priority editor on the class Combos page. */
export function desiredBuildsEditorPath(classType: ClassType): string {
  return combosPagePath(classType, { hash: '#combos' });
}
