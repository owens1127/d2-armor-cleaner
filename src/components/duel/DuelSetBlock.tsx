import { getArmorSetPerkLines } from '@/lib/constants';
import { ArmorSetIcons } from '@/components/ArmorSetIcons';
import type { ArmorSetInfo } from '@/types';

interface DuelSetBlockProps {
  setInfo: ArmorSetInfo | undefined;
  setName: string;
  /** User prefs favor this set over the opponent's. */
  preferred?: boolean;
  /** Opponent wears a different armor set. */
  differsFromOpponent?: boolean;
}

export function DuelSetBlock({
  setInfo,
  setName,
  preferred = false,
  differsFromOpponent = false,
}: DuelSetBlockProps) {
  const perks = getArmorSetPerkLines(setInfo);

  const muted = !preferred && differsFromOpponent;

  return (
    <div
      className={`duel-set-block min-h-[5.5rem] rounded border px-4 py-4 ${
        preferred
          ? 'border-white/30 bg-white/[0.06]'
          : muted
            ? 'border-border/40 bg-surface/30'
            : 'border-border/60 bg-surface-3/40'
      }`}
    >
      <div
        className={`text-xs font-semibold leading-snug truncate inline-flex items-center gap-1.5 min-w-0 ${
          preferred ? 'text-white' : 'text-muted'
        }`}
      >
        {setInfo && (
          <ArmorSetIcons
            setHash={setInfo.hash}
            setInfo={setInfo}
            size="sm"
            maxIcons={2}
          />
        )}
        <span className="truncate">{setName}</span>
        {preferred && (
          <span className="ml-1 text-[9px] font-medium uppercase tracking-wider text-white/70">
            Preferred
          </span>
        )}
      </div>

      {perks.length > 0 ? (
        <div className="duel-set-block__perks mt-1.5 space-y-1.5">
          {perks.map((perk) => (
            <div key={perk.prefix}>
              <div className="text-[9px] font-medium uppercase tracking-wider text-muted">
                {perk.prefix}
              </div>
              <p
                className={`text-[11px] leading-snug line-clamp-2 ${
                  preferred ? 'text-white/85' : 'text-muted'
                }`}
                title={perk.text}
              >
                {perk.text}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-0.5 text-[11px] text-muted">No set bonuses listed</p>
      )}
    </div>
  );
}
