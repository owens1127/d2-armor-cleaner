import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SlotIcon } from '@/components/SlotIcon';
import {
  activeBucketItemCount,
  bucketKeyString,
  dupeBucketPrimaryLine,
  dupeBucketSecondaryLine,
} from '@/lib/dupes/queue';
import type { DupeBucket } from '@/types';

interface DuelBucketChooserProps {
  classLabel: string;
  buckets: DupeBucket[];
  onSelect: (bucketKey: string) => void;
}

export function DuelBucketChooser({ classLabel, buckets, onSelect }: DuelBucketChooserProps) {
  const { t } = useTranslation('duel');
  const sorted = useMemo(() => buckets, [buckets]);

  return (
    <div className="text-left py-8 ui-card w-full max-w-lg mx-auto px-6">
      <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted mb-1">
        {t('chooser.kicker')}
      </p>
      <h2 className="ui-heading text-xl font-medium text-white mb-1">{t('chooser.title')}</h2>
      <p className="text-sm text-muted mb-5">{t('chooser.intro', { class: classLabel })}</p>

      <ul
        role="listbox"
        aria-label={t('chooser.listAria', { class: classLabel })}
        className="rounded-md border border-border bg-surface-2 max-h-[min(20rem,50vh)] overflow-y-auto"
      >
        {sorted.map((b) => {
          const key = bucketKeyString(b.key);
          const count = activeBucketItemCount(b);
          return (
            <li key={key} role="presentation">
              <button
                type="button"
                role="option"
                onClick={() => onSelect(key)}
                className="w-full px-3 py-2.5 text-left transition-colors border-b border-white/[0.06] last:border-b-0 hover:bg-white/5"
              >
                <span className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 rounded-md border border-white/[0.08] bg-surface-3 p-1.5">
                    <SlotIcon slot={b.key.armorSlot} size="sm" />
                  </span>
                  <span className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-semibold text-white leading-tight">
                      {dupeBucketPrimaryLine(b.key)}
                    </span>
                    <span className="text-xs text-white/65 leading-snug">
                      {dupeBucketSecondaryLine(b.key, count)}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
