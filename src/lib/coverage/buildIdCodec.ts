import { CLASSES, STATS } from '@/lib/constants';
import type { ClassType, DesiredBuild, Stat, StatTarget } from '@/types';

/** Reversible combo id prefix - version 1, URL-safe base64url payload. */
export const BUILD_ID_PREFIX = 'b1.';

export const ENCODED_BUILD_ID_PATTERN = /^b1\.[A-Za-z0-9_-]+$/;

export type BuildIdDefinition = {
  classType: ClassType;
  targetsMode: 'tier' | 'custom';
  enabled: boolean;
  statTargets: StatTarget[];
  setBonus2pc?: number;
  setBonus4pc?: number;
};

type WirePayload = {
  c: number;
  m: 0 | 1;
  e: 0 | 1;
  s: [number, number][];
  b?: [number, number];
};

const CLASS_INDEX = Object.fromEntries(CLASSES.map((c, i) => [c, i])) as Record<
  ClassType,
  number
>;

function statIndex(stat: Stat): number | null {
  const index = STATS.indexOf(stat);
  return index >= 0 ? index : null;
}

function statFromIndex(index: number): Stat | null {
  return STATS[index] ?? null;
}

function classFromIndex(index: number): ClassType | null {
  return CLASSES[index] ?? null;
}

function clampTarget(value: number): number {
  return Math.min(200, Math.max(10, Math.round(value)));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToText(encoded: string): string | null {
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (padded.length % 4)) % 4;
    const binary = atob(padded + '='.repeat(padLen));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function isEncodedBuildId(value: string): boolean {
  return ENCODED_BUILD_ID_PATTERN.test(value);
}

export function definitionFromDesiredBuild(
  build: Pick<
    DesiredBuild,
    'statTargets' | 'targetsMode' | 'mode' | 'setBonus2pc' | 'setBonus4pc' | 'enabled'
  >,
  classType: ClassType,
): BuildIdDefinition {
  const targetsMode =
    build.targetsMode ?? (build.mode === 'custom' ? 'custom' : 'tier');
  return {
    classType,
    targetsMode,
    enabled: build.enabled !== false,
    statTargets: build.statTargets.map(({ stat, target }) => ({
      stat,
      target: clampTarget(target),
    })),
    ...(build.setBonus2pc !== undefined ? { setBonus2pc: build.setBonus2pc } : {}),
    ...(build.setBonus4pc !== undefined ? { setBonus4pc: build.setBonus4pc } : {}),
  };
}

function toWire(definition: BuildIdDefinition): WirePayload | null {
  if (definition.statTargets.length < 2 || definition.statTargets.length > 4) {
    return null;
  }
  const classIndex = CLASS_INDEX[definition.classType];
  if (classIndex === undefined) return null;

  const pairs: [number, number][] = [];
  const seen = new Set<number>();
  for (const { stat, target } of definition.statTargets) {
    const index = statIndex(stat);
    if (index === null || seen.has(index)) return null;
    seen.add(index);
    pairs.push([index, clampTarget(target)]);
  }

  const wire: WirePayload = {
    c: classIndex,
    m: definition.targetsMode === 'custom' ? 1 : 0,
    e: definition.enabled ? 1 : 0,
    s: pairs,
  };

  if (definition.setBonus2pc !== undefined || definition.setBonus4pc !== undefined) {
    const two = definition.setBonus2pc;
    const four = definition.setBonus4pc;
    if (
      two === undefined ||
      four === undefined ||
      !Number.isFinite(two) ||
      !Number.isFinite(four) ||
      two <= 0 ||
      four <= 0
    ) {
      return null;
    }
    wire.b = [Math.round(two), Math.round(four)];
  }

  return wire;
}

function fromWire(wire: WirePayload): BuildIdDefinition | null {
  const classType = classFromIndex(wire.c);
  if (!classType) return null;
  if (wire.m !== 0 && wire.m !== 1) return null;
  if (wire.e !== 0 && wire.e !== 1) return null;
  if (!Array.isArray(wire.s) || wire.s.length < 2 || wire.s.length > 4) return null;

  const statTargets: StatTarget[] = [];
  const seen = new Set<number>();
  for (const pair of wire.s) {
    if (!Array.isArray(pair) || pair.length !== 2) return null;
    const [index, target] = pair;
    if (typeof index !== 'number' || typeof target !== 'number') return null;
    if (seen.has(index)) return null;
    const stat = statFromIndex(index);
    if (!stat) return null;
    seen.add(index);
    statTargets.push({ stat, target: clampTarget(target) });
  }

  let setBonus2pc: number | undefined;
  let setBonus4pc: number | undefined;
  if (wire.b !== undefined) {
    if (!Array.isArray(wire.b) || wire.b.length !== 2) return null;
    const [two, four] = wire.b;
    if (typeof two !== 'number' || typeof four !== 'number' || two <= 0 || four <= 0) {
      return null;
    }
    setBonus2pc = Math.round(two);
    setBonus4pc = Math.round(four);
  }

  return {
    classType,
    targetsMode: wire.m === 1 ? 'custom' : 'tier',
    enabled: wire.e === 1,
    statTargets,
    ...(setBonus2pc !== undefined ? { setBonus2pc } : {}),
    ...(setBonus4pc !== undefined ? { setBonus4pc } : {}),
  };
}

/** Reversible URL-safe combo id from a canonical build definition. */
export function encodeBuildId(definition: BuildIdDefinition): string {
  const wire = toWire(definition);
  if (!wire) {
    throw new Error('Invalid build definition for encoding');
  }
  const json = JSON.stringify(wire);
  return `${BUILD_ID_PREFIX}${bytesToBase64Url(new TextEncoder().encode(json))}`;
}

/** Decode a shareable combo id back to its build definition. */
export function decodeBuildId(id: string): BuildIdDefinition | null {
  if (!id.startsWith(BUILD_ID_PREFIX)) return null;
  const encoded = id.slice(BUILD_ID_PREFIX.length);
  if (!encoded) return null;

  const json = base64UrlToText(encoded);
  if (!json) return null;

  let wire: unknown;
  try {
    wire = JSON.parse(json);
  } catch {
    return null;
  }

  if (!wire || typeof wire !== 'object') return null;
  return fromWire(wire as WirePayload);
}

export function encodeDesiredBuildId(
  build: Pick<
    DesiredBuild,
    'statTargets' | 'targetsMode' | 'mode' | 'setBonus2pc' | 'setBonus4pc' | 'enabled'
  >,
  classType: ClassType,
): string {
  return encodeBuildId(definitionFromDesiredBuild(build, classType));
}

export function desiredBuildFromEncodedId(
  id: string,
  name: string,
): DesiredBuild | null {
  const definition = decodeBuildId(id);
  if (!definition) return null;
  return {
    id,
    name,
    mode: definition.targetsMode === 'custom' ? 'custom' : 'priority',
    targetsMode: definition.targetsMode,
    statTargets: definition.statTargets,
    enabled: definition.enabled,
    ...(definition.setBonus2pc !== undefined ? { setBonus2pc: definition.setBonus2pc } : {}),
    ...(definition.setBonus4pc !== undefined ? { setBonus4pc: definition.setBonus4pc } : {}),
  };
}
