import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
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
import { COPY_BUTTON_LABELS, copyButtonAnnouncement, type CopyButtonKey } from '@/pages/reviewCopyFeedback';
import { useVaultFocusRefresh } from '@/lib/vault/useVaultFocusRefresh';
import { useAuthStore, useSessionStore, useVaultStore } from '@/stores';
import type { BungieMembership } from '@/types';

export function ReviewPage() {
  const { membership } = useAuthStore();
  useVaultFocusRefresh({ refreshOnMount: true });

  if (!membership) return <Navigate to="/" replace />;

  return (
    <Layout>
      <ReviewPageContent membership={membership} />
    </Layout>
  );
}

function ReviewPageContent({ membership }: { membership: BungieMembership }) {
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
          `Applied ${okIds.size} of ${tags.length} tags. ${failIds.length} failed: retry or remove from queue.`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to apply tags');
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
        `Clear all ${reviewTags.length} pending tags? They will not be applied to DIM. Compare session progress is kept.`,
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
      <h1 className="text-2xl font-bold mb-2">Review tags</h1>
      <p className="text-muted mb-2">
        {reviewTags.length} queued · {keep.length} keep · {junk.length} junk. Apply writes queued
        tags; rows note existing DIM tags when different.
      </p>
      <div className="mb-8" />

      {applied && (
        <div className="mb-6 p-4 rounded-lg border border-border bg-surface-3 text-white">
          Tags applied to DIM Sync.
          <a
            href="https://app.destinyitemmanager.com/?tag:junk"
            target="_blank"
            rel="noreferrer"
            className="block mt-2 underline text-sm"
          >
            Open junk in DIM
          </a>
        </div>
      )}

      {partialApplied !== null && !applied && (
        <div className="mb-6 p-4 rounded-lg border border-border bg-surface-3 text-muted text-sm">
          Partially applied: {partialApplied} tags succeeded. Failed items remain in the queue.
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
              Retry {failedIds.length} failed
            </button>
          )}
        </div>
      )}

      {reviewTags.length === 0 && !applied && (
        <p className="text-muted mb-4">
          No pending tags.{' '}
          <Link to={`/duel/${reviewClass}`} className="text-white hover:underline">
            Compare duplicates
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
              aria-label={COPY_BUTTON_LABELS.ids}
            >
              <span aria-hidden className="invisible">
                {COPY_BUTTON_LABELS.ids}
              </span>
              <span
                aria-hidden
                className="absolute inset-0 flex items-center justify-center transition-opacity"
              >
                {copied === 'ids' ? 'Copied!' : COPY_BUTTON_LABELS.ids}
              </span>
            </button>
            <button
              type="button"
              onClick={() => copyText('junk', dimJunkSearchQuery())}
              className="relative text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-white/5"
              aria-label={COPY_BUTTON_LABELS.junk}
            >
              <span aria-hidden className="invisible">
                {COPY_BUTTON_LABELS.junk}
              </span>
              <span
                aria-hidden
                className="absolute inset-0 flex items-center justify-center transition-opacity"
              >
                {copied === 'junk' ? 'Copied!' : COPY_BUTTON_LABELS.junk}
              </span>
            </button>
            {junk.length > 0 && (
              <button
                type="button"
                onClick={() => copyText('junk-ids', dimIdQuery(junk))}
                className="relative text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-white/5"
                aria-label={COPY_BUTTON_LABELS['junk-ids']}
              >
                <span aria-hidden className="invisible">
                  {COPY_BUTTON_LABELS['junk-ids']}
                </span>
                <span
                  aria-hidden
                  className="absolute inset-0 flex items-center justify-center transition-opacity"
                >
                  {copied === 'junk-ids' ? 'Copied!' : COPY_BUTTON_LABELS['junk-ids']}
                </span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto border border-border rounded-lg mb-6">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-surface-2 text-muted text-left">
                <tr>
                  <th className="px-3 py-2 w-[28%] min-w-[8rem]">Item</th>
                  <th className="px-3 py-2 w-10">
                    <span className="sr-only">Copy DIM query</span>
                  </th>
                  <th className="px-3 py-2">Archetype</th>
                  <th className="px-3 py-2">Tertiary</th>
                  <th className="px-3 py-2">Tuning</th>
                  <th className="px-3 py-2">Class</th>
                  <th className="px-3 py-2">Combo</th>
                  <th className="px-3 py-2">Applies to DIM</th>
                  <th className="px-3 py-2 w-16" />
                </tr>
              </thead>
              <tbody>
                {reviewTags.map((t) => {
                  const roll = resolveTagRollProfile(t, itemsById);
                  const comboSignal = comboSignalById.get(t.instanceId);
                  return (
                    <tr
                      key={t.instanceId}
                      className={`border-t border-border ${failedIds.includes(t.instanceId) ? 'bg-danger/5' : ''}`}
                    >
                      <td className="px-3 py-2 max-w-0">
                        <span className="block truncate" title={t.itemName}>
                          {t.itemName}
                        </span>
                      </td>
                      <td className="px-3 py-2 w-10">
                        <CopyDimQueryButton
                          instanceId={t.instanceId}
                          itemName={t.itemName}
                          compact
                        />
                      </td>
                      <td className="px-3 py-2 text-xs text-muted whitespace-nowrap">
                        {roll?.archetype ?? 'None'}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted whitespace-nowrap">
                        {roll?.tertiary ?? 'None'}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted whitespace-nowrap">
                        {roll?.tuning ?? 'None'}
                      </td>
                      <td className="px-3 py-2 capitalize">{t.classType}</td>
                      <td className="px-3 py-2 text-xs">
                        {comboSignal ? (
                          <ReviewComboSignal
                            count={comboSignal.count}
                            title={comboSignal.title}
                            variant={comboSignal.variant}
                            testId={`review-combo-${t.instanceId}`}
                          />
                        ) : (
                          <span data-testid={`review-combo-${t.instanceId}`} className="text-muted">
                            ·                           </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {t.tag ? (
                          <ReviewTagCell
                            pendingTag={t.tag}
                            dimTag={itemsById.get(t.instanceId)?.dimTag}
                            dimFavorite={itemsById.get(t.instanceId)?.dimFavorite}
                            failed={failedIds.includes(t.instanceId)}
                          />
                        ) : (
                          'None'
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removePendingTag(t.instanceId)}
                          className="ui-icon-btn--compact text-lg leading-none text-muted hover:text-danger hover:bg-danger/10 border border-transparent hover:border-danger/25"
                          title="Remove from queue"
                          aria-label="Remove from queue"
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
              {loading ? 'Applying…' : `Apply ${reviewTags.length} tags to DIM`}
            </button>
            <button
              type="button"
              onClick={confirmClearPendingTags}
              className="px-4 py-2.5 rounded-lg border border-border text-sm text-danger/80 hover:text-danger hover:border-danger/35"
            >
              Clear pending tags
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    'Clear the entire compare session? Pending tags and in-progress compare state will be reset.',
                  )
                ) {
                  clearSession();
                }
              }}
              className="px-4 py-2.5 rounded-lg border border-border text-sm text-muted hover:text-white"
            >
              Clear session
            </button>
          </div>
        </>
      )}

      <Link to={`/dashboard/${reviewClass}`} className="inline-block mt-8 text-sm text-muted hover:text-white">
        Back to dashboard
      </Link>
    </>
  );
}
