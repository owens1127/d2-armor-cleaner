import { i18n } from '@/i18n';
import { CLASSES } from '@/lib/constants';
import { getKeepTargetTotal } from '@/lib/onboarding/inventorySnapshot';
import type { VaultKeepPreference } from '@/types';

function targetPerClassForPreference(id: VaultKeepPreference): number {
  return Math.round(getKeepTargetTotal(id) / CLASSES.length);
}

export function vaultKeepOptionLabel(id: VaultKeepPreference): string {
  return i18n.t(`onboarding:keepOptions.${id}.label`);
}

export function vaultKeepOptionDescription(id: VaultKeepPreference): string {
  const perClass = targetPerClassForPreference(id);
  return i18n.t('onboarding:keepOptions.description', {
    blurb: i18n.t(`onboarding:keepOptions.${id}.blurb`),
    perClass,
  });
}
