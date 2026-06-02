import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  buildVaultInsightActions,
  type VaultInsightAction,
} from '@/lib/dashboard/vaultInsightsActions';
import { useSessionStore } from '@/stores';
import type { ClassPreferenceProfile, ClassVaultState, ClassType } from '@/types';

interface VaultInsightsProps {
  classState: ClassVaultState;
  classType: ClassType;
  prefs: ClassPreferenceProfile;
  redundantRollCount: number;
}

export function VaultInsights({
  classState,
  classType,
  prefs,
  redundantRollCount,
}: VaultInsightsProps) {
  const pendingTags = useSessionStore((s) => s.pendingTags);
  const bucketJunkedIds = useSessionStore((s) => s.bucketJunkedIds);

  const actions: VaultInsightAction[] = useMemo(
    () =>
      buildVaultInsightActions({
        classState,
        classType,
        prefs,
        redundantRollCount,
        pendingTags,
        bucketJunkedIds,
      }),
    [classState, classType, prefs, redundantRollCount, pendingTags, bucketJunkedIds],
  );

  if (actions.length === 0) {
    return null;
  }

  return (
    <section className="mb-8 p-4 border border-border rounded-xl bg-surface-2">
      <div className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Recommended actions
        </h2>
        <p className="text-xs text-muted mt-1">
          Suggested next steps from your vault scan and calibrated preferences.
        </p>
      </div>
      <ul className="space-y-2">
        {actions.map((action) => (
          <li key={action.id}>
            <Link
              to={action.to}
              className="flex cursor-pointer items-center justify-between gap-3 text-sm border border-border rounded-lg px-3 py-2.5 bg-surface hover:bg-white/5 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-white font-medium truncate">{action.title}</p>
                <p className="text-xs text-muted mt-0.5">{action.detail}</p>
              </div>
              <span
                className={`shrink-0 text-xs px-2.5 py-1 rounded-md border ${
                  action.tone === 'danger'
                    ? 'border-danger/40 text-danger/90'
                    : action.tone === 'accent'
                      ? 'border-accent/40 text-accent-dim'
                      : 'border-border text-white'
                }`}
              >
                {action.cta}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
