import { useEffect, useMemo, useState } from 'react';
import { statLabel } from '@/i18n/gameCopy';
import { STATS } from '@/lib/constants';
import type { TFunction } from 'i18next';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArmorSetIcons } from '@/components/ArmorSetIcons';
import { StatIcon } from '@/components/StatIcon';
import {
  collectArmorSetsFromItems,
  formatSetBonusTargetsSummary,
  isDualTwoPieceMix,
} from '@/lib/coverage/setBonus';
import {
  assignEncodedBuildId,
  createDesiredBuild,
  formatStatTargetsLabel,
  MAX_STAT_PRIORITIES,
  MIN_STAT_PRIORITIES,
  normalizeDesiredBuilds,
  patchDesiredBuildSetBonus,
  patchDesiredBuildStatTargets,
} from '@/lib/coverage/builds';
import {
  cancelBuildEdit,
  createDesiredBuildEditSession,
  finishBuildEdit,
  isBuildEditing,
  isDesiredBuildDirty,
  mergeDesiredBuildDraft,
  startBuildEdit,
  type DesiredBuildEditSession,
} from '@/lib/coverage/desiredBuildEditor';
import { COMBOS_SECTION_ID, restoreScrollY } from '@/lib/nav/hashScroll';
import { getClassPrefs, updateClassPrefs } from '@/lib/prefs/profile';
import { usePrefsStore, useSessionStore } from '@/stores';
import type { ArmorPiece, ClassType, DesiredBuild, Stat, StatTarget } from '@/types';

const MAX_BUILDS = 8;

const PRIORITY_KEYS = [
  'editor.priority1',
  'editor.priority2',
  'editor.priority3',
  'editor.priority4',
] as const;

function priorityLabel(t: TFunction<'build'>, idx: number): string {
  return PRIORITY_KEYS[idx] ? t(PRIORITY_KEYS[idx]) : t('editor.priorityN', { n: idx + 1 });
}

function storedBuilds(
  prefs: ReturnType<typeof getClassPrefs>,
  classType: ClassType,
): DesiredBuild[] {
  return normalizeDesiredBuilds(prefs.desiredBuilds, classType);
}

function uniqueStatOptions(current: Stat[], selected: Stat): Stat[] {
  return STATS.filter((s) => s === selected || !current.includes(s));
}

function statTargetEntry(stat: Stat): StatTarget {
  return { stat, target: 0 };
}

function ComboSaveStatusBadge({ dirty }: { dirty: boolean }) {
  const { t } = useTranslation('build');
  if (dirty) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/35 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200/90 shrink-0">
        {t('editor.unsaved')}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/70 shrink-0">
      <span aria-hidden className="text-[11px] leading-none">
        ✓
      </span>
      {t('editor.saved')}
    </span>
  );
}

function CoverageIncludeIndicator({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation('build');
  if (enabled) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/80">
        <span aria-hidden className="text-[11px] leading-none">
          ✓
        </span>
        {t('editor.on')}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
      {t('editor.off')}
    </span>
  );
}

interface ComboReadOnlyViewProps {
  build: DesiredBuild;
  vaultItems: ArmorPiece[];
  onEdit: () => void;
  onRemove: () => void;
}

function ComboReadOnlyView({ build, vaultItems, onEdit, onRemove }: ComboReadOnlyViewProps) {
  const { t } = useTranslation('build');
  const enabled = build.enabled !== false;
  const setSummary = formatSetBonusTargetsSummary(
    build.setBonus2pc,
    build.setBonus4pc,
    vaultItems,
  );
  const uniqueSetHashes = [build.setBonus2pc, build.setBonus4pc]
    .filter((hash): hash is number => hash !== undefined)
    .filter((hash, index, arr) => arr.indexOf(hash) === index);

  return (
    <>
      <div className="flex flex-wrap items-start gap-2">
        <h3 className="flex-1 min-w-0 text-sm font-medium text-white">{build.name}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs rounded-md border border-white/25 bg-white/10 px-2.5 py-1 text-white hover:bg-white/15"
        >
          {t('editor.edit')}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-danger/80 hover:text-danger px-2 py-1"
        >
          {t('editor.remove')}
        </button>
      </div>

      <div className="space-y-1.5">
        {build.statTargets.map((target, idx) => (
          <div key={`${build.id}-ro-${idx}`} className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted min-w-0 sm:min-w-[6.75rem] shrink-0">
              {priorityLabel(t, idx)}
            </span>
            <StatIcon stat={target.stat} size="sm" variant="glyph" />
            <span className="text-sm text-white/90">{statLabel(target.stat)}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-muted">
        <span>{t('orderLabel')}</span>
        {build.statTargets.map(({ stat }) => (
          <StatIcon key={stat} stat={stat} size="sm" variant="glyph" />
        ))}
        <span className="text-white/80">{formatStatTargetsLabel(build.statTargets)}</span>
      </div>

      {setSummary ? (
        <div className="pt-1 border-t border-border/60">
          <p className="text-xs text-muted mb-1">{t('setBonuses')}</p>
          <p className="text-sm text-white/80 inline-flex flex-wrap items-center gap-1.5">
            <span>
              {setSummary}
              {isDualTwoPieceMix(build.setBonus2pc, build.setBonus4pc) && (
                <span className="text-muted">{t('twoTwoMix')}</span>
              )}
            </span>
            {uniqueSetHashes.map((hash) => (
              <ArmorSetIcons
                key={hash}
                setHash={hash}
                items={vaultItems}
                size="sm"
                maxIcons={2}
              />
            ))}
          </p>
        </div>
      ) : null}

      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted">{t('includeInCoverage')}</span>
        <CoverageIncludeIndicator enabled={enabled} />
      </div>
    </>
  );
}

interface ComboEditViewProps {
  build: DesiredBuild;
  dirty: boolean;
  armorSets: { hash: number; name: string }[];
  vaultItems: ArmorPiece[];
  onSave: () => void;
  onCancel: () => void;
  onRemove: () => void;
  onNameChange: (name: string) => void;
  onPriorityStatChange: (index: number, stat: Stat) => void;
  onAddPriorityStat: () => void;
  onRemovePriorityStat: (index: number) => void;
  onSetBonusChange: (field: 'setBonus2pc' | 'setBonus4pc', raw: string) => void;
  onEnabledChange: (enabled: boolean) => void;
}

function ComboEditView({
  build,
  dirty,
  armorSets,
  vaultItems,
  onSave,
  onCancel,
  onRemove,
  onNameChange,
  onPriorityStatChange,
  onAddPriorityStat,
  onRemovePriorityStat,
  onSetBonusChange,
  onEnabledChange,
}: ComboEditViewProps) {
  const { t } = useTranslation('build');
  return (
    <>
      <div className="flex flex-wrap items-start gap-2">
        <input
          type="text"
          value={build.name}
          onChange={(e) => onNameChange(e.target.value)}
          className={[
            'flex-1 min-w-0 w-full bg-surface border rounded-md px-2 py-1 text-sm text-white',
            dirty ? 'border-amber-400/35' : 'border-border',
          ].join(' ')}
          aria-label={t('comboNameAria')}
        />
        <ComboSaveStatusBadge dirty={dirty} />
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty}
            className="text-xs rounded-md border border-white/25 bg-white/10 px-2.5 py-1 text-white hover:bg-white/15 disabled:opacity-40 disabled:hover:bg-white/10"
          >
            {t('editor.save')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs rounded-md border border-border px-2.5 py-1 text-muted hover:text-white hover:border-white/20"
          >
            {t('editor.cancel')}
          </button>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-danger/80 hover:text-danger px-2 py-1 ml-auto"
        >
          {t('editor.remove')}
        </button>
      </div>

      <div className="space-y-2">
        {build.statTargets.map((target, idx) => (
          <div key={`${build.id}-${idx}`} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted w-full min-w-0 sm:min-w-[6.75rem]">
              {priorityLabel(t, idx)}
              <select
                value={target.stat}
                onChange={(e) => onPriorityStatChange(idx, e.target.value as Stat)}
                className={[
                  'bg-surface border rounded-md px-2 py-1.5 text-sm text-white',
                  dirty ? 'border-amber-400/35' : 'border-border',
                ].join(' ')}
              >
                {uniqueStatOptions(
                  build.statTargets.map((t) => t.stat),
                  target.stat,
                ).map((s) => (
                  <option key={s} value={s}>
                    {statLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            {build.statTargets.length > MIN_STAT_PRIORITIES && (
              <button
                type="button"
                onClick={() => onRemovePriorityStat(idx)}
                className="text-xs text-muted hover:text-white pb-1.5"
              >
                {t('editor.remove')}
              </button>
            )}
          </div>
        ))}
        {build.statTargets.length < MAX_STAT_PRIORITIES && (
          <button
            type="button"
            onClick={onAddPriorityStat}
            className="text-xs text-accent-dim hover:text-white"
          >
            {t('editor.addStatCount', {
              current: build.statTargets.length,
              max: MAX_STAT_PRIORITIES,
            })}
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-muted">
        <span>{t('orderLabel')}</span>
        {build.statTargets.map(({ stat }) => (
          <StatIcon key={stat} stat={stat} size="sm" variant="glyph" />
        ))}
        <span className="text-white/80">{formatStatTargetsLabel(build.statTargets)}</span>
      </div>

      <div className="space-y-2 pt-1 border-t border-border/60">
        <p className="text-xs text-muted">{t('setBonusesOptional')}</p>
        {armorSets.length === 0 ? (
          <p className="text-[11px] text-muted">{t('editor.loadVaultForSets')}</p>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                {t('editor.setBonus2pc')}
                {build.setBonus2pc !== undefined && (
                  <ArmorSetIcons
                    setHash={build.setBonus2pc}
                    items={vaultItems}
                    size="sm"
                    maxIcons={1}
                  />
                )}
              </span>
              <select
                value={build.setBonus2pc ?? ''}
                onChange={(e) => onSetBonusChange('setBonus2pc', e.target.value)}
                className={[
                  'bg-surface border rounded-md px-2 py-1.5 text-sm text-white',
                  dirty ? 'border-amber-400/35' : 'border-border',
                ].join(' ')}
              >
                <option value="">{t('noneOption')}</option>
                {armorSets.map(({ hash, name }) => (
                  <option key={hash} value={hash}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            {build.setBonus2pc !== undefined && (
              <label className="flex flex-col gap-1 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5">
                  {build.setBonus4pc === build.setBonus2pc
                    ? t('editor.setBonus4pcSame')
                    : t('editor.setBonus4pcMix')}
                  {build.setBonus4pc !== undefined && (
                    <ArmorSetIcons
                      setHash={build.setBonus4pc}
                      items={vaultItems}
                      size="sm"
                      maxIcons={build.setBonus4pc === build.setBonus2pc ? 2 : 1}
                    />
                  )}
                </span>
                <select
                  value={build.setBonus4pc ?? ''}
                  onChange={(e) => onSetBonusChange('setBonus4pc', e.target.value)}
                  className={[
                    'bg-surface border rounded-md px-2 py-1.5 text-sm text-white',
                    dirty ? 'border-amber-400/35' : 'border-border',
                  ].join(' ')}
                >
                  <option value="">{t('editor.twoPcOnly')}</option>
                  {armorSets.map(({ hash, name }) => (
                    <option key={hash} value={hash}>
                      {hash === build.setBonus2pc
                        ? t('editor.set4pcSuffix', { name })
                        : t('editor.set2pcMixSuffix', { name })}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(build.setBonus2pc !== undefined || build.setBonus4pc !== undefined) && (
              <p className="text-[11px] text-white/80 inline-flex flex-wrap items-center gap-1.5">
                <span>
                  {t('editor.targetLabel')}{' '}
                  {formatSetBonusTargetsSummary(
                    build.setBonus2pc,
                    build.setBonus4pc,
                    vaultItems,
                  ) || '-'}
                  {isDualTwoPieceMix(build.setBonus2pc, build.setBonus4pc) && (
                    <span className="text-muted">{t('twoTwoMix')}</span>
                  )}
                </span>
                {[build.setBonus2pc, build.setBonus4pc]
                  .filter((hash): hash is number => hash !== undefined)
                  .filter((hash, index, arr) => arr.indexOf(hash) === index)
                  .map((hash) => (
                    <ArmorSetIcons
                      key={hash}
                      setHash={hash}
                      items={vaultItems}
                      size="sm"
                      maxIcons={2}
                    />
                  ))}
              </p>
            )}
          </>
        )}
      </div>

      <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
        <input
          type="checkbox"
          checked={build.enabled !== false}
          onChange={(e) => onEnabledChange(e.target.checked)}
          className="accent-accent"
        />
        {t('includeInCoverage')}
      </label>
    </>
  );
}

interface DesiredBuildsSectionProps {
  /** Pre-select class (e.g. current Combos page). */
  defaultClass?: ClassType;
  /** Hide link back to combo coverage when already on that page. */
  hideCoverageLink?: boolean;
  /** Vault items for this class - used to populate armor set pickers. */
  vaultItems?: ArmorPiece[];
}

export function DesiredBuildsSection({
  defaultClass,
  hideCoverageLink = false,
  vaultItems = [],
}: DesiredBuildsSectionProps = {}) {
  const { profile, updateProfile } = usePrefsStore();
  const activeNavClass = useSessionStore((s) => s.activeNavClass);
  const classType = defaultClass ?? activeNavClass;
  const [editSession, setEditSession] = useState<DesiredBuildEditSession>(
    createDesiredBuildEditSession(),
  );

  useEffect(() => {
    setEditSession(createDesiredBuildEditSession());
  }, [classType]);

  const classPrefs = getClassPrefs(profile, classType);
  const savedBuilds = storedBuilds(classPrefs, classType);
  const armorSets = collectArmorSetsFromItems(
    vaultItems.filter((i) => i.classType === classType),
  );

  const dirtyBuildIds = useMemo(() => {
    const ids = new Set<string>();
    for (const saved of savedBuilds) {
      const draft = editSession.drafts[saved.id];
      if (draft && isDesiredBuildDirty(draft, saved)) ids.add(saved.id);
    }
    return ids;
  }, [editSession.drafts, savedBuilds]);

  const editingId = editSession.editingId;
  const hasUnsavedChanges = dirtyBuildIds.size > 0;

  function getEditableBuild(saved: DesiredBuild): DesiredBuild {
    return editSession.drafts[saved.id] ?? saved;
  }

  function setDraft(id: string, next: DesiredBuild) {
    setEditSession((session) => ({
      ...session,
      drafts: { ...session.drafts, [id]: next },
    }));
  }

  function saveBuilds(next: DesiredBuild[]) {
    updateProfile((p) =>
      updateClassPrefs(p, classType, (prefs) => ({
        ...prefs,
        desiredBuilds: normalizeDesiredBuilds(next, classType),
      })),
    );
  }

  function patchDraftBuild(saved: DesiredBuild, patch: Partial<DesiredBuild>) {
    setDraft(saved.id, mergeDesiredBuildDraft(getEditableBuild(saved), patch));
  }

  function updateSetBonus(
    saved: DesiredBuild,
    field: 'setBonus2pc' | 'setBonus4pc',
    raw: string,
  ) {
    const build = getEditableBuild(saved);
    const value = raw === '' ? undefined : Number(raw);
    const parsed = Number.isFinite(value) && value! > 0 ? value : undefined;
    let nextSetBonus2pc = build.setBonus2pc;
    let nextSetBonus4pc = build.setBonus4pc;
    if (field === 'setBonus2pc') {
      nextSetBonus2pc = parsed;
      if (parsed === undefined) nextSetBonus4pc = undefined;
    } else {
      nextSetBonus4pc = parsed;
    }
    patchDraftBuild(
      saved,
      patchDesiredBuildSetBonus(build, nextSetBonus2pc, nextSetBonus4pc, vaultItems),
    );
  }

  function updatePriorityStat(saved: DesiredBuild, index: number, stat: Stat) {
    const build = getEditableBuild(saved);
    const nextTargets = build.statTargets.map((t, i) =>
      i === index ? statTargetEntry(stat) : t,
    );
    patchDraftBuild(saved, patchDesiredBuildStatTargets(build, nextTargets, vaultItems));
  }

  function addPriorityStat(saved: DesiredBuild) {
    const build = getEditableBuild(saved);
    const used = new Set(build.statTargets.map((t) => t.stat));
    const nextStat = STATS.find((s) => !used.has(s));
    if (!nextStat || build.statTargets.length >= MAX_STAT_PRIORITIES) return;
    const nextTargets = [...build.statTargets, statTargetEntry(nextStat)];
    patchDraftBuild(saved, patchDesiredBuildStatTargets(build, nextTargets, vaultItems));
  }

  function removePriorityStat(saved: DesiredBuild, index: number) {
    const build = getEditableBuild(saved);
    if (build.statTargets.length <= MIN_STAT_PRIORITIES) return;
    const nextTargets = build.statTargets.filter((_, i) => i !== index);
    patchDraftBuild(saved, patchDesiredBuildStatTargets(build, nextTargets, vaultItems));
  }

  function startEdit(id: string) {
    setEditSession((session) => startBuildEdit(session, id));
  }

  function saveBuild(id: string) {
    const saved = savedBuilds.find((b) => b.id === id);
    const draft = editSession.drafts[id];
    if (!saved || !draft || !isDesiredBuildDirty(draft, saved)) return;
    const canonical = assignEncodedBuildId(draft, classType, id);
    saveBuilds(savedBuilds.map((b) => (b.id === id ? canonical : b)));
    setEditSession((session) => finishBuildEdit(session, id));
  }

  function cancelBuild(id: string) {
    setEditSession((session) => cancelBuildEdit(session, id));
  }

  function removeBuild(id: string) {
    setEditSession((session) => cancelBuildEdit(session, id));
    saveBuilds(savedBuilds.filter((b) => b.id !== id));
  }

  function addBuild() {
    if (savedBuilds.length >= MAX_BUILDS) return;
    const scrollY = window.scrollY;
    const nextBuild = createDesiredBuild(classPrefs, classType, undefined, 'tier', savedBuilds);
    saveBuilds([...savedBuilds, nextBuild]);
    setEditSession((session) => startBuildEdit(session, nextBuild.id));
    restoreScrollY(scrollY);
  }

  const { t } = useTranslation('build');

  return (
    <section id={COMBOS_SECTION_ID} className="mb-10 max-w-xl space-y-4 scroll-mt-6">
      <div>
        <h2 className="text-sm font-semibold uppercase text-muted mb-2">{t('combosHeading')}</h2>
        <p className="text-sm text-muted max-w-lg">{t('editor.intro')}</p>
        {editingId !== null ? (
          hasUnsavedChanges ? (
            <p className="mt-2 text-xs text-amber-200/90">{t('editor.unsavedHint')}</p>
          ) : (
            <p className="mt-2 text-xs text-muted">{t('editor.editingHint')}</p>
          )
        ) : savedBuilds.length > 0 ? (
          <p className="mt-2 text-xs text-muted">{t('editor.allSavedHint')}</p>
        ) : null}
      </div>

      {savedBuilds.length === 0 ? (
        <p className="text-sm text-muted rounded-xl border border-border bg-surface-2/50 px-4 py-3">
          {t('editor.emptyList')}
        </p>
      ) : (
        <ul className="space-y-3 mb-4">
          {savedBuilds.map((saved) => {
            const editing = isBuildEditing(editSession, saved.id);
            const build = editing ? getEditableBuild(saved) : saved;
            const dirty = dirtyBuildIds.has(saved.id);

            return (
              <li
                key={saved.id}
                className={[
                  'rounded-xl border p-3 space-y-3 transition-colors',
                  editing && dirty
                    ? 'border-amber-400/35 bg-amber-400/5'
                    : editing
                      ? 'border-white/20 bg-surface-2/70'
                      : 'border-border bg-surface-2/50',
                ].join(' ')}
              >
                {editing ? (
                  <ComboEditView
                    build={build}
                    dirty={dirty}
                    armorSets={armorSets}
                    vaultItems={vaultItems}
                    onSave={() => saveBuild(saved.id)}
                    onCancel={() => cancelBuild(saved.id)}
                    onRemove={() => removeBuild(saved.id)}
                    onNameChange={(name) => patchDraftBuild(saved, { name })}
                    onPriorityStatChange={(index, stat) => updatePriorityStat(saved, index, stat)}
                    onAddPriorityStat={() => addPriorityStat(saved)}
                    onRemovePriorityStat={(index) => removePriorityStat(saved, index)}
                    onSetBonusChange={(field, raw) => updateSetBonus(saved, field, raw)}
                    onEnabledChange={(enabled) => patchDraftBuild(saved, { enabled })}
                  />
                ) : (
                  <ComboReadOnlyView
                    build={saved}
                    vaultItems={vaultItems}
                    onEdit={() => startEdit(saved.id)}
                    onRemove={() => removeBuild(saved.id)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-xl border border-border bg-surface-2/50 p-4 space-y-3">
        <button
          type="button"
          onClick={addBuild}
          disabled={savedBuilds.length >= MAX_BUILDS}
          className="text-xs bg-surface border border-border rounded-lg px-3 py-1.5 disabled:opacity-50 hover:border-white/20"
        >
          {savedBuilds.length === 0 ? t('editor.addCombo') : t('editor.addAnotherCombo')}
        </button>
        {savedBuilds.length >= MAX_BUILDS && (
          <p className="text-xs text-muted">{t('maxCombos', { max: MAX_BUILDS })}</p>
        )}
      </div>

      {!hideCoverageLink && (
        <p className="text-xs text-muted mt-3">
          <Link
            to={`/combos/${classType}`}
            className="hover:text-white underline-offset-2 hover:underline"
          >
            {t('editor.viewCoverageLink', { class: classType })}
          </Link>
          .
        </p>
      )}
    </section>
  );
}
