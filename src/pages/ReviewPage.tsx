import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { BuildOptimalContext } from '@/components/items/buildOptimalContext';
import { ReviewComboSignal } from '@/components/items/ReviewComboSignal';
import { ReviewTagCell } from '@/components/items/ReviewTagCell';
import { CopyDimQueryButton } from '@/components/items/CopyDimQueryButton';
import { applyDimTags } from '@/lib/dim/tags';
import { resolveDimToken } from '@/lib/dim/resolveToken';
import { dimIdQuery, dimJunkSearchQuery } from '@/lib/session/persist';
import { buildReviewComboSignalMap } from '@/lib/review/comboSignal';
import { normalizePendingTags, resolveTagRollProfile } from '@/lib/session/reviewTags';
import { useTranslation } from 'react-i18next';
import { copyButtonAnnouncement, copyButtonLabel, type CopyButtonKey } from '@/pages/reviewCopyFeedback';
import { useVaultFocusRefresh } from '@/lib/vault/useVaultFocusRefresh';
import { useAuthStore, useSessionStore, useVaultStore } from '@/stores';
import type { BungieMembership } from '@/types';

export function ReviewPage() {
  const { membership } = useAuthStore();
  useVaultFocusRefresh({ refreshOnMount: true });

  return (
    <Layout>
      <ReviewPageContent membership={membership!} />
    </Layout>
  );
}

function ReviewPageContent({ membership }: { membership: BungieMembership }) {
  const { t } = useTranslation(['review', 'common', 'errors']);
  const allItems = useVaultStore((s) => s.allItems);
  const {
    pendingTags,
    clearSession,
    clearPendingTags,
    removePendingTag,
  } = useSessionStore();
  const [applied, setApplied] = useState(false);
  const [partialApplied, setPartialApplied] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<CopyButtonKey | null>(null);
  const copyResetTimerRef = useRef<number | null>(null);
  const buildOptimalLookups = useContext(BuildOptimalContext);
  const reviewTags = useMemo(() => normalizePendingTags(pendingTags), [pendingTags]);
  const itemsById = useMemo(
    () => new Map(allItems.map((item) => [item.instanceId, item])),
    [allItems],
  );
  const comboSignalById = useMemo(
    () => buildReviewComboSignalMap(reviewTags, itemsById, buildOptimalLookups),
    [buildOptimalLookups, itemsById, reviewTags],
  );

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  async function applyTags(onlyIds?: Set<string>) {
    setLoading(true);
    setError(null);
    setFailedIds([]);
    try {
      const batch = onlyIds
        ? reviewTags.filter((t) => onlyIds.has(t.instanceId))
        : reviewTags;
      const tags = batch.map((t) => ({
        instanceId: t.instanceId,
        tag: t.tag,
      }));
      if (tags.length === 0) return;

      const dimToken = await resolveDimToken(membership);
      const summary = await applyDimTags(membership.destinyMembershipId, dimToken, tags);

      const okIds = new Set(summary.applied.filter((r) => r.ok).map((r) => r.instanceId));
      const failIds = summary.applied.filter((r) => !r.ok).map((r) => r.instanceId);

      if (okIds.size > 0) {
        useVaultStore.getState().patchItemDimTags(
          tags.filter((t) => okIds.has(t.instanceId)),
        );
      }

      for (const id of okIds) {
        removePendingTag(id);
      }

      if (summary.allOk) {
        setApplied(true);
        setPartialApplied(null);
        clearSession();
      } else {
        setPartialApplied(okIds.size);
        setFailedIds(failIds);
        setError(
          t('errors:partialApply', {
            ok: okIds.size,
            total: tags.length,
            failed: failIds.length,
          }),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors:applyTagsFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function copyText(label: CopyButtonKey, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    if (copyResetTimerRef.current !== null) {
      window.clearTimeout(copyResetTimerRef.current);
    }
    copyResetTimerRef.current = window.setTimeout(() => {
      setCopied(null);
      copyResetTimerRef.current = null;
    }, 2000);
  }

  function confirmClearPendingTags() {
    if (
      !confirm(
        t('confirm.clearPending', { count: reviewTags.length }),
      )
    ) {
      return;
    }
    clearPendingTags();
    setApplied(false);
    setPartialApplied(null);
    setFailedIds([]);
    setError(null);
  }

  const keep = reviewTags.filter((t) => t.tag === 'keep');
  const junk = reviewTags.filter((t) => t.tag === 'junk');
  const reviewClass = reviewTags[0]?.classType ?? 'hunter';

  return (
    <>
      <h1 className="text-2xl font-bold mb-2">{t('title')}</h1>
      <p className="text-muted mb-2">
        {t('summary', { total: reviewTags.length, keep: keep.length, junk: junk.length })}
      </p>
      <div className="mb-8" />

      {applied && (
        <div className="mb-6 p-4 rounded-lg border border-border bg-surface-3 text-white">
          {t('applied')}
          <a
            href="https://app.destinyitemmanager.com/?tag:junk"
            target="_blank"
            rel="noreferrer"
            className="block mt-2 underline text-sm"
          >
            {t('openJunkInDim')}
          </a>
        </div>
      )}

      {partialApplied !== null && !applied && (
        <div className="mb-6 p-4 rounded-lg border border-border bg-surface-3 text-muted text-sm">
          {t('partialApplied', { count: partialApplied })}
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-lg border border-danger/30 bg-danger/10 text-danger text-sm">
          {error}
          {failedIds.length > 0 && (
            <button
              type="button"
              disabled={loading}
              onClick={() => applyTags(new Set(failedIds))}
              className="block mt-2 underline hover:no-underline"
            >
              {t('retryFailed', { count: failedIds.length })}
            </button>
          )}
        </div>
      )}

      {reviewTags.length === 0 && !applied && (
        <p className="text-muted mb-4">
          {t('empty')}{' '}
          <Link to={`/duel/${reviewClass}`} className="text-white hover:underline">
            {t('compareDupes')}
          </Link>
        </p>
      )}

      {reviewTags.length > 0 && (
        <>
          <p className="sr-only" aria-live="polite" role="status">
            {copyButtonAnnouncement(copied)}
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={() => copyText('ids', dimIdQuery(reviewTags))}
              className="relative text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-white/5"
              aria-label={copyButtonLabel('ids')}
            >
              <span aria-hidden className="invisible">
                {copyButtonLabel('ids')}
              </span>
              <span
                aria-hidden
                className="absolute inset-0 flex items-center justify-center transition-opacity"
              >
                {copied === 'ids' ? t('copy.copied') : copyButtonLabel('ids')}
              </span>
            </button>
            <button
              type="button"
              onClick={() => copyText('junk', dimJunkSearchQuery())}
              className="relative text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-white/5"
              aria-label={copyButtonLabel('junk')}
            >
              <span aria-hidden className="invisible">
                {copyButtonLabel('junk')}
              </span>
              <span
                aria-hidden
                className="absolute inset-0 flex items-center justify-center transition-opacity"
              >
                {copied === 'junk' ? t('copy.copied') : copyButtonLabel('junk')}
              </span>
            </button>
            {junk.length > 0 && (
              <button
                type="button"
                onClick={() => copyText('junk-ids', dimIdQuery(junk))}
                className="relative text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-white/5"
                aria-label={copyButtonLabel('junk-ids')}
              >
                <span aria-hidden className="invisible">
                  {copyButtonLabel('junk-ids')}
                </span>
                <span
                  aria-hidden
                  className="absolute inset-0 flex items-center justify-center transition-opacity"
                >
                  {copied === 'junk-ids' ? t('copy.copied') : copyButtonLabel('junk-ids')}
                </span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto border border-border rounded-lg mb-6">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-surface-2 text-muted text-left">
                <tr>
                  <th className="px-3 py-2 w-[28%] min-w-[5.5rem] sm:min-w-[8rem]">{t('table.item')}</th>
                  <th className="px-3 py-2 w-10">
                    <span className="sr-only">{t('table.copyDimSr')}</span>
                  </th>
                  <th className="px-3 py-2">{t('table.archetype')}</th>
                  <th className="px-3 py-2">{t('table.tertiary')}</th>
                  <th className="px-3 py-2">{t('table.tuning')}</th>
                  <th className="px-3 py-2">{t('table.class')}</th>
                  <th className="px-3 py-2">{t('table.combo')}</th>
                  <th className="px-3 py-2">{t('table.appliesToDim')}</th>
                  <th className="px-3 py-2 w-16" />
                </tr>
              </thead>
              <tbody>
                {reviewTags.map((row) => {
                  const roll = resolveTagRollProfile(row, itemsById);
                  const comboSignal = comboSignalById.get(row.instanceId);
                  return (
                    <tr
                      key={row.instanceId}
                      className={`border-t border-border ${failedIds.includes(row.instanceId) ? 'bg-danger/5' : ''}`}
                    >
                      <td className="px-3 py-2 max-w-0">
                        <span className="block truncate" title={row.itemName}>
                          {row.itemName}
                        </span>
                      </td>
                      <td className="px-3 py-2 w-10">
                        <CopyDimQueryButton
                          instanceId={row.instanceId}
                          itemName={row.itemName}
                          compact
                        />
                      </td>
                      <td className="px-3 py-2 text-xs text-muted whitespace-nowrap">
                        {roll?.archetype ?? t('table.none')}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted whitespace-nowrap">
                        {roll?.tertiary ?? t('table.none')}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted whitespace-nowrap">
                        {roll?.tuning ?? t('table.none')}
                      </td>
                      <td className="px-3 py-2 capitalize">{row.classType}</td>
                      <td className="px-3 py-2 text-xs">
                        {comboSignal ? (
                          <ReviewComboSignal
                            count={comboSignal.count}
                            title={comboSignal.title}
                            variant={comboSignal.variant}
                            testId={`review-combo-${row.instanceId}`}
                          />
                        ) : (
                          <span data-testid={`review-combo-${row.instanceId}`} className="text-muted">
                            ·                           </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.tag ? (
                          <ReviewTagCell
                            pendingTag={row.tag}
                            dimTag={itemsById.get(row.instanceId)?.dimTag}
                            dimFavorite={itemsById.get(row.instanceId)?.dimFavorite}
                            failed={failedIds.includes(row.instanceId)}
                          />
                        ) : (
                          t('table.none')
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removePendingTag(row.instanceId)}
                          className="ui-icon-btn--compact text-lg leading-none text-muted hover:text-danger hover:bg-danger/10 border border-transparent hover:border-danger/25"
                          title={t('removeFromQueue')}
                          aria-label={t('removeFromQueue')}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={loading || applied || reviewTags.length === 0}
              onClick={() => applyTags()}
              className="px-5 py-2.5 rounded-lg bg-accent text-surface font-semibold disabled:opacity-50"
            >
              {loading ? t('applying') : t('applyTags', { count: reviewTags.length })}
            </button>
            <button
              type="button"
              onClick={confirmClearPendingTags}
              className="px-4 py-2.5 rounded-lg border border-border text-sm text-danger/80 hover:text-danger hover:border-danger/35"
            >
              {t('clearPending')}
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(t('confirm.clearSession'))) {
                  clearSession();
                }
              }}
              className="px-4 py-2.5 rounded-lg border border-border text-sm text-muted hover:text-white"
            >
              {t('clearSession')}
            </button>
          </div>
        </>
      )}

      <Link to={`/dashboard/${reviewClass}`} className="inline-block mt-8 text-sm text-muted hover:text-white">
        {t('backToDashboard')}
      </Link>
    </>
  );
}
