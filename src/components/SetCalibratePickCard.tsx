import { getArmorSetPerkLines } from '@/lib/constants';
import type { ArmorSetInfo } from '@/types';

interface SetCalibratePickCardProps {
  setInfo: ArmorSetInfo | undefined;
  setName: string;
  onPick: () => void;
  disabled?: boolean;
}

export function SetCalibratePickCard({
  setInfo,
  setName,
  onPick,
  disabled = false,
}: SetCalibratePickCardProps) {
  const perks = getArmorSetPerkLines(setInfo);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface-2">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4">
        <div className="flex flex-col gap-3 pb-3">
          <h3 className="text-base font-semibold leading-snug text-white">{setName}</h3>

          {perks.length > 0 ? (
            <div className="space-y-3">
              {perks.map((perk) => (
                <div key={perk.prefix}>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                    {perk.prefix}
                  </div>
                  <p className="mt-0.5 text-sm leading-relaxed text-neutral-200">{perk.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No set bonuses listed</p>
          )}
        </div>
      </div>

      <div className="shrink-0 px-4 pb-4 pt-2">
        <button
          type="button"
          onClick={onPick}
          disabled={disabled}
          aria-label={`Prefer ${setName}`}
          aria-busy={disabled}
          className={`ui-btn-primary w-full shrink-0 py-3 text-sm font-semibold transition-transform active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
            disabled ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          Prefer this set
        </button>
      </div>
    </div>
  );
}
