import { ARMOR_SLOTS, CLASSES } from '@/lib/constants';
import type { ArmorPiece, ArmorSlot, ClassType, VaultKeepPreference } from '@/types';

export const VAULT_KEEP_OPTIONS: {
  id: VaultKeepPreference;
  label: string;
  description: string;
  targetPerClass: number;
}[] = [
  {
    id: 'lean',
    label: 'Lean',
    description: '~15 pieces per class: trim aggressively',
    targetPerClass: 15,
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: '~25 pieces per class: clear dupes, keep variety',
    targetPerClass: 25,
  },
  {
    id: 'options',
    label: 'Keep options',
    description: '~40 pieces per class: room for combos',
    targetPerClass: 40,
  },
  {
    id: 'hoarder',
    label: 'Hoarder',
    description: '~60 pieces per class: only obvious dupes',
    targetPerClass: 60,
  },
];

const LOW_SLOT_COUNT = 3;
const LOW_CLASS_RATIO = 0.4;

export interface VaultGap {
  classType: ClassType;
  kind: 'low_class' | 'low_slot';
  armorSlot?: ArmorSlot;
  count: number;
  message: string;
}

export interface ClassTrimEstimate {
  current: number;
  target: number;
  excess: number;
}

export interface VaultInventorySnapshot {
  totalT5: number;
  byClass: Record<ClassType, number>;
  byClassSlot: Record<ClassType, Record<ArmorSlot, number>>;
  gaps: VaultGap[];
}

export interface VaultTrimEstimate {
  preference: VaultKeepPreference;
  targetPerClass: number;
  totalTarget: number;
  excess: number;
  byClass: Record<ClassType, ClassTrimEstimate>;
}

export function getKeepTarget(preference: VaultKeepPreference = 'balanced'): number {
  return VAULT_KEEP_OPTIONS.find((o) => o.id === preference)?.targetPerClass ?? 25;
}

/** Thresholds for “large vault” dupe-rule suggestions: scales with keep preference. */
export function vaultHeavyThreshold(preference?: VaultKeepPreference): {
  totalT5: number;
  heavyBuckets: number;
} {
  const target = getKeepTarget(preference ?? 'balanced');
  const heavyBuckets =
    preference === 'lean' ? 5 : preference === 'hoarder' ? 12 : preference === 'options' ? 10 : 8;
  return {
    totalT5: Math.round(target * CLASSES.length * 1.5),
    heavyBuckets,
  };
}

export function buildVaultInventorySnapshot(items: ArmorPiece[]): VaultInventorySnapshot {
  const t5 = items.filter((i) => (i.tier ?? 0) >= 5);

  const byClass = Object.fromEntries(
    CLASSES.map((c) => [c, t5.filter((i) => i.classType === c).length]),
  ) as Record<ClassType, number>;

  const byClassSlot = Object.fromEntries(
    CLASSES.map((c) => [
      c,
      Object.fromEntries(
        ARMOR_SLOTS.map((slot) => [
          slot,
          t5.filter((i) => i.classType === c && i.armorSlot === slot).length,
        ]),
      ) as Record<ArmorSlot, number>,
    ]),
  ) as Record<ClassType, Record<ArmorSlot, number>>;

  const gaps = detectVaultGaps(byClass, byClassSlot);

  return {
    totalT5: t5.length,
    byClass,
    byClassSlot,
    gaps,
  };
}

export function detectVaultGaps(
  byClass: Record<ClassType, number>,
  byClassSlot: Record<ClassType, Record<ArmorSlot, number>>,
): VaultGap[] {
  const gaps: VaultGap[] = [];
  const maxClass = Math.max(...CLASSES.map((c) => byClass[c]), 1);

  for (const classType of CLASSES) {
    const count = byClass[classType];
    if (count > 0 && count < maxClass * LOW_CLASS_RATIO) {
      gaps.push({
        classType,
        kind: 'low_class',
        count,
        message: `${count} pieces: well below your ${maxClass}-piece high class`,
      });
    }

    for (const slot of ARMOR_SLOTS) {
      const slotCount = byClassSlot[classType][slot];
      if (slotCount < LOW_SLOT_COUNT) {
        gaps.push({
          classType,
          kind: 'low_slot',
          armorSlot: slot,
          count: slotCount,
          message:
            slotCount === 0
              ? `No ${slot} pieces: fill this slot before trimming dupes`
              : `Only ${slotCount} ${slot}: thin coverage`,
        });
      }
    }
  }

  return gaps;
}

export function estimateVaultTrim(
  snapshot: VaultInventorySnapshot,
  preference: VaultKeepPreference,
): VaultTrimEstimate {
  const targetPerClass = getKeepTarget(preference);
  const totalTarget = targetPerClass * CLASSES.length;

  const byClass = Object.fromEntries(
    CLASSES.map((c) => {
      const current = snapshot.byClass[c];
      const excess = Math.max(0, current - targetPerClass);
      return [c, { current, target: targetPerClass, excess }];
    }),
  ) as Record<ClassType, ClassTrimEstimate>;

  const excess = Math.max(0, snapshot.totalT5 - totalTarget);

  return {
    preference,
    targetPerClass,
    totalTarget,
    excess,
    byClass,
  };
}

// TODO: use estimateVaultTrim on CleanPage to surface per-class trim targets and defer cleaning for thin slots.
