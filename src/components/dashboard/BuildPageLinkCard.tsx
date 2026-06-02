import { Link } from 'react-router-dom';
import { normalizeDesiredBuilds } from '@/lib/coverage/analyze';
import { getDesiredBuilds } from '@/lib/coverage/builds';
import { combosPagePath } from '@/lib/nav';
import type { ClassPreferenceProfile, ClassType } from '@/types';

interface BuildPageLinkCardProps {
  classType: ClassType;
  prefs: ClassPreferenceProfile;
}

export function BuildPageLinkCard({ classType, prefs }: BuildPageLinkCardProps) {
  const buildCount = normalizeDesiredBuilds(prefs.desiredBuilds, classType).length;
  const firstEnabledBuildId = getDesiredBuilds(prefs, classType)[0]?.id;

  return (
    <section className="mb-8 p-3 border border-border rounded-xl bg-surface-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Your combos</h2>
          <p className="text-xs text-muted mt-0.5 max-w-xl">
            {buildCount > 0
              ? `${buildCount} ${buildCount === 1 ? 'combo' : 'combos'} — loadout coverage, projected totals, and keep/favorite actions`
              : 'Set up combos to see whether your vault can hit your targets'}
          </p>
        </div>
        <Link
          to={combosPagePath(classType, firstEnabledBuildId ? { buildId: firstEnabledBuildId } : undefined)}
          className="shrink-0 text-sm px-3 py-1.5 rounded-md border border-border bg-surface hover:border-white/20 hover:bg-white/5 transition-colors"
        >
          Open combos
        </Link>
      </div>
    </section>
  );
}
