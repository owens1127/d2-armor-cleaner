import { createContext, useContext } from 'react';
import type {
  BuildOptimalIndicatorVariant,
  BuildOptimalLookup,
  BuildOptimalRollIdentity,
} from '@/lib/coverage/buildOptimal';
import type { ClassType } from '@/types';

export const BuildOptimalContext = createContext<
  ReadonlyMap<ClassType, BuildOptimalLookup>
>(new Map());

const EMPTY_LOOKUP: BuildOptimalLookup = {
  isOptimal: () => false,
  buildCount: () => 0,
  tooltip: () => undefined,
  indicatorVariant: () => 'default',
};

export function useBuildOptimalForPiece(
  piece: BuildOptimalRollIdentity & { classType: ClassType; instanceId: string },
  options?: { setScopeHash?: number },
): {
  buildOptimal: boolean;
  buildOptimalCount: number;
  buildOptimalTitle?: string;
  buildOptimalVariant: BuildOptimalIndicatorVariant;
} {
  const lookups = useContext(BuildOptimalContext);
  const lookup = lookups.get(piece.classType) ?? EMPTY_LOOKUP;
  const buildOptimalCount = lookup.buildCount(piece);
  const buildOptimal = buildOptimalCount > 0;
  const lookupOptions =
    options?.setScopeHash !== undefined
      ? { setScopeHash: options.setScopeHash }
      : undefined;
  return {
    buildOptimal,
    buildOptimalCount,
    buildOptimalTitle: buildOptimal
      ? lookup.tooltip(piece, lookupOptions)
      : undefined,
    buildOptimalVariant: buildOptimal
      ? lookup.indicatorVariant(piece.instanceId, lookupOptions)
      : 'default',
  };
}
