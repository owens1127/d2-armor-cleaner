import { useMemo } from 'react';
import { statLabel, archetypeLabel, slotLabel } from '@/i18n/gameCopy';
import { useTranslation } from 'react-i18next';
import { SlotIcon } from '@/components/SlotIcon';
import {
  activeBucketItemCount,
  bucketKeyString,
  sortBucketsForPicker,
} from '@/lib/dupes/queue';
import {
  formatWrapUpSessionContext,
  wrapUpGroupsRemainingAfterCurrent,
  type BucketWrapUpReport,
} from '@/lib/session/bucketWrapUp';
import type { DupeBucket } from '@/types';

interface BucketWrapUpPanelProps {
  bucket: DupeBucket;
  report: BucketWrapUpReport;
  otherBuckets: DupeBucket[];
  nextBucket: DupeBucket | null;
  groupsInQueue: number;
  choosingBucket: boolean;
  onContinue: () => void;
  onStartChooseBucket: () => void;
  onSelectBucket: (key: string) => void;
  onCancelChooseBucket: () => void;
}

function bucketPrimaryLine(bucket: DupeBucket): string {
  return `${archetypeLabel(bucket.key.archetype)} · ${statLabel(bucket.key.tertiaryStat)}`;
}

function bucketSecondaryLine(bucket: DupeBucket, _count: number, pieceLabel: string): string {
  return `${slotLabel(bucket.key.armorSlot)} · ${pieceLabel}`;
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-surface-2 px-3 py-2.5 text-left">
      <div className="text-lg font-semibold text-white tabular-nums">{value}</div>
      <div className="text-[0.65rem] text-muted leading-snug">{label}</div>
    </div>
  );
}

function BucketIdentity({
  bucket,
  status,
  pieceLabel,
}: {
  bucket: DupeBucket;
  status: string;
  pieceLabel: string;
}) {
  const count = activeBucketItemCount(bucket);

  return (
    <div className="rounded-md border border-border bg-surface-2 px-4 py-3 text-left mb-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 rounded-md border border-white/[0.08] bg-surface-3 p-2">
          <SlotIcon slot={bucket.key.armorSlot} size="md" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-white leading-tight">{bucketPrimaryLine(bucket)}</p>
          <p className="text-sm text-white/65 mt-0.5">{bucketSecondaryLine(bucket, count, pieceLabel)}</p>
          <p className="text-xs text-accent-dim mt-2">{status}</p>
        </div>
      </div>
    </div>
  );
}

export function BucketWrapUpPanel({
  bucket,
  report,
  otherBuckets,
  nextBucket,
  groupsInQueue,
  choosingBucket,
  onContinue,
  onStartChooseBucket,
  onSelectBucket,
  onCancelChooseBucket,
}: BucketWrapUpPanelProps) {
  const { t } = useTranslation('duel');
  const sortedOthers = useMemo(() => sortBucketsForPicker(otherBuckets), [otherBuckets]);
  const groupsRemaining = wrapUpGroupsRemainingAfterCurrent(groupsInQueue);
  const sessionContext = formatWrapUpSessionContext(groupsRemaining);
  const continueLabel = nextBucket
    ? t('wrapUp.continueNext')
    : t('wrapUp.applyTagsContinue');
  const pieceLabel = (count: number) => t('wrapUp.piece', { count });

  return (
    <div className="text-left py-8 ui-card w-full max-w-lg mx-auto px-6">
      <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted mb-1">
        {t('wrapUp.kicker')}
      </p>
      <h2 className="ui-heading text-xl font-medium text-white mb-5">{t('wrapUp.title')}</h2>

      <BucketIdentity
        bucket={bucket}
        status={t('wrapUp.allPairsDecided')}
        pieceLabel={pieceLabel(activeBucketItemCount(bucket))}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        <StatCell label={t('wrapUp.stats.keeps')} value={report.keepCount} />
        <StatCell label={t('wrapUp.stats.junkQueued')} value={report.junkCount} />
        <StatCell label={t('wrapUp.stats.preferEliminated')} value={report.tournamentEliminatedCount} />
        <StatCell label={t('wrapUp.stats.pairsDecided')} value={report.pairsActed} />
        <StatCell label={t('wrapUp.stats.inGroup')} value={report.totalItems} />
      </div>

      {(report.keptBothCount > 0 ||
        report.keptSideCount > 0 ||
        report.explicitJunkCount > 0 ||
        report.preferInProgressCount > 0) && (
        <ul className="text-xs text-muted space-y-1 mb-5 px-0.5">
          {report.keptBothCount > 0 && (
            <li>{t('wrapUp.breakdown.keepBoth', { count: report.keptBothCount })}</li>
          )}
          {report.keptSideCount > 0 && (
            <li>{t('wrapUp.breakdown.keepSide', { count: report.keptSideCount })}</li>
          )}
          {report.explicitJunkCount > 0 && (
            <li>{t('wrapUp.breakdown.junkedInDuels', { count: report.explicitJunkCount })}</li>
          )}
          {report.preferInProgressCount > 0 && (
            <li>{t('wrapUp.breakdown.preferInPlay', { count: report.preferInProgressCount })}</li>
          )}
        </ul>
      )}

      {!choosingBucket && (
        <div className="rounded-md border border-border bg-surface-2 px-4 py-3 mb-6">
          <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted mb-2">
            {t('wrapUp.whatsNext')}
          </p>
          {nextBucket ? (
            <>
              <p className="text-sm font-semibold text-white leading-tight">
                {bucketPrimaryLine(nextBucket)}
              </p>
              <p className="text-xs text-white/65 mt-0.5">
                {bucketSecondaryLine(
                  nextBucket,
                  activeBucketItemCount(nextBucket),
                  pieceLabel(activeBucketItemCount(nextBucket)),
                )}{' '}
                · {sessionContext}
              </p>
            </>
          ) : (
            <p className="text-sm text-white/65">{sessionContext}</p>
          )}
        </div>
      )}

      {!choosingBucket ? (
        <div className="flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={onContinue} className="ui-btn-primary flex-1 px-6 py-3">
            {continueLabel}
          </button>
          {sortedOthers.length > 0 && (
            <button
              type="button"
              onClick={onStartChooseBucket}
              className="ui-btn-secondary flex-1 px-6 py-3"
            >
              {t('wrapUp.chooseDifferent')}
            </button>
          )}
        </div>
      ) : (
        <div>
          <p className="text-sm font-medium text-white mb-1">{t('wrapUp.chooseNext')}</p>
          <p className="text-xs text-muted mb-3">{sessionContext}</p>
          <ul
            role="listbox"
            aria-label={t('wrapUp.nextGroupsAria')}
            className="rounded-md border border-border bg-surface-2 max-h-[min(16rem,40vh)] overflow-y-auto mb-4"
          >
            {sortedOthers.map((b) => {
              const key = bucketKeyString(b.key);
              const count = activeBucketItemCount(b);
              return (
                <li key={key} role="presentation">
                  <button
                    type="button"
                    role="option"
                    onClick={() => onSelectBucket(key)}
                    className="w-full px-3 py-2.5 text-left transition-colors border-b border-white/[0.06] last:border-b-0 hover:bg-white/5"
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-white leading-tight">
                        {bucketPrimaryLine(b)}
                      </span>
                      <span className="text-xs text-white/65 leading-snug">
                        {bucketSecondaryLine(b, count, pieceLabel(count))}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={onCancelChooseBucket}
            className="ui-btn-secondary w-full sm:w-auto px-6 py-2 text-sm"
          >
            {t('wrapUp.backToSummary')}
          </button>
        </div>
      )}

      <p className="m-0 mt-5 pt-4 text-[0.6875rem] leading-relaxed text-muted border-t border-border/40">
        {t('wrapUp.tagsFootnote')}
      </p>
    </div>
  );
}
