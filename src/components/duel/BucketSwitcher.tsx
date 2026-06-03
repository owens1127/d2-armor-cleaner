import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  activeBucketItemCount,
  bucketKeyString,
  dupeBucketPrimaryLine,
  dupeBucketSecondaryLine,
  sortBucketsForPicker,
} from '@/lib/dupes/queue';
import type { DupeBucket } from '@/types';

interface BucketSwitcherProps {
  buckets: DupeBucket[];
  currentKey: string | null;
  onSelect: (key: string) => void;
  disabled?: boolean;
  /** Completed buckets earlier in this session (for session-wide position labels). */
  completedBuckets?: number;
  sessionTotal?: number;
}

export function BucketSwitcher({
  buckets,
  currentKey,
  onSelect,
  disabled = false,
  completedBuckets = 0,
  sessionTotal,
}: BucketSwitcherProps) {
  const { t } = useTranslation('duel');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const sorted = useMemo(() => sortBucketsForPicker(buckets), [buckets]);
  const current = useMemo(
    () => sorted.find((b) => bucketKeyString(b.key) === currentKey) ?? sorted[0] ?? null,
    [sorted, currentKey],
  );
  const positionIndex = current ? sorted.indexOf(current) : -1;
  const positionLabel =
    positionIndex >= 0 && sorted.length > 0
      ? sessionTotal != null && sessionTotal > 0
        ? `${completedBuckets + positionIndex + 1} of ${sessionTotal}`
        : `${positionIndex + 1} of ${sorted.length}`
      : null;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (sorted.length === 0) return null;

  const triggerDisabled = disabled || sorted.length <= 1;

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1 text-xs w-full min-w-0 max-w-full sm:min-w-[240px] sm:max-w-[360px]">
      <span className="font-medium uppercase tracking-wide text-[0.65rem] text-muted">{t('bucket.label')}</span>
      <button
        type="button"
        disabled={triggerDisabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (!triggerDisabled) setOpen((v) => !v);
        }}
        className={[
          'relative w-full rounded-md border border-border bg-surface-2 px-3 py-2 pr-8 text-left transition-colors',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          open ? 'border-white/25 bg-surface-3' : 'hover:border-white/15 hover:bg-surface-3',
        ].join(' ')}
      >
        {current ? (
          <span className="flex flex-col gap-0.5">
            {positionLabel && (
              <span className="text-[0.65rem] text-accent-dim tabular-nums">{positionLabel}</span>
            )}
            <span className="text-sm font-semibold text-white leading-tight">
              {dupeBucketPrimaryLine(current.key)}
            </span>
            <span className="text-xs text-white/65 leading-snug">
              {dupeBucketSecondaryLine(current.key, activeBucketItemCount(current))}
            </span>
          </span>
        ) : (
          <span className="text-sm text-white/65">{t('bucket.select')}</span>
        )}
        {sorted.length > 1 && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-[0.65rem] pointer-events-none"
            aria-hidden
          >
            ▾
          </span>
        )}
      </button>

      {open && sorted.length > 1 && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t('bucket.dupeBucketsAria')}
          className="absolute z-50 top-full left-0 mt-1 min-w-full w-max max-w-[min(24rem,90vw)] max-h-[min(20rem,60vh)] overflow-y-auto rounded-md border border-border bg-surface-2 shadow-lg"
        >
          {sorted.map((b, i) => {
            const key = bucketKeyString(b.key);
            const isCurrent = key === currentKey;
            const count = activeBucketItemCount(b);
            return (
              <li key={key} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isCurrent}
                  onClick={() => {
                    setOpen(false);
                    if (key !== currentKey) onSelect(key);
                  }}
                  className={[
                    'w-full px-3 py-2.5 text-left transition-colors border-l-2 border-b border-white/[0.06] last:border-b-0',
                    isCurrent
                      ? 'border-l-white/50 bg-white/10 text-white'
                      : 'border-l-transparent text-white hover:bg-white/5 hover:border-l-white/20',
                  ].join(' ')}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-white leading-tight">
                        {dupeBucketPrimaryLine(b.key)}
                      </span>
                      <span className="text-xs text-white/65 leading-snug">
                        {dupeBucketSecondaryLine(b.key, count)}
                      </span>
                    </span>
                    <span className="shrink-0 flex flex-col items-end gap-0.5 text-[0.65rem] tabular-nums text-accent-dim">
                      <span>
                        {sessionTotal != null && sessionTotal > 0
                          ? completedBuckets + i + 1
                          : i + 1}
                      </span>
                      {isCurrent && (
                        <span className="text-white font-medium uppercase tracking-wide">
                          Current
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
