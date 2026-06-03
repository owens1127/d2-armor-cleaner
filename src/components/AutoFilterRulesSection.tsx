import {
  ARCHETYPES,
  ARCHETYPE_LABELS,
  ARMOR_SLOTS,
  CLASS_LABELS,
  CLASSES,
  SLOT_LABELS,
  STAT_LABELS,
  STATS,
} from '@/lib/constants';
import {
  countAutoFilterMatches,
  createAutoFilterRule,
  describeAutoFilterRule,
} from '@/lib/auto-filter/match';
import { calibrationSetPieces } from '@/lib/scoring/calibrate';
import { useSessionStore, useVaultStore } from '@/stores';
import { usePrefsStore } from '@/stores/prefsStore';
import type {
  AutoFilterClassScope,
  AutoFilterMatchMode,
  AutoFilterRule,
  Archetype,
  ArmorSlot,
  Stat,
} from '@/types';
import { useMemo, useState } from 'react';

const IS: AutoFilterMatchMode = 'is';
const NOT: AutoFilterMatchMode = 'not';
const ANY_OF: AutoFilterMatchMode = 'anyOf';
const NONE_OF: AutoFilterMatchMode = 'noneOf';

type DraftRule = {
  classType: AutoFilterClassScope;
  archetypeValues: Archetype[];
  archetypeMatchMode: AutoFilterMatchMode;
  tertiaryStatValues: Stat[];
  tertiaryStatMatchMode: AutoFilterMatchMode;
  tuningStatValues: Stat[];
  tuningStatMatchMode: AutoFilterMatchMode;
  armorSlotValues: ArmorSlot[];
  armorSlotMatchMode: AutoFilterMatchMode;
  armorSetHashValues: number[];
  armorSetHashMatchMode: AutoFilterMatchMode;
};

const emptyDraft = (): DraftRule => ({
  classType: 'hunter',
  archetypeValues: [],
  archetypeMatchMode: IS,
  tertiaryStatValues: [],
  tertiaryStatMatchMode: IS,
  tuningStatValues: [],
  tuningStatMatchMode: IS,
  armorSlotValues: [],
  armorSlotMatchMode: IS,
  armorSetHashValues: [],
  armorSetHashMatchMode: IS,
});

function isMultiMatchMode(mode: AutoFilterMatchMode): boolean {
  return mode === ANY_OF || mode === NONE_OF;
}

function draftCriterionToRule<T extends string | number>(
  values: T[],
  matchMode: AutoFilterMatchMode,
  singleKey: string,
  multiKey: string,
  modeKey: string,
): Record<string, unknown> {
  if (values.length === 0) return {};
  const useMulti = isMultiMatchMode(matchMode) || values.length > 1;
  return {
    ...(useMulti ? { [multiKey]: values } : { [singleKey]: values[0] }),
    ...(matchMode !== IS ? { [modeKey]: matchMode } : {}),
  };
}

function draftToRule(draft: DraftRule): AutoFilterRule {
  return createAutoFilterRule({
    classType: draft.classType,
    ...draftCriterionToRule(
      draft.archetypeValues,
      draft.archetypeMatchMode,
      'archetype',
      'archetypes',
      'archetypeMatchMode',
    ),
    ...draftCriterionToRule(
      draft.tertiaryStatValues,
      draft.tertiaryStatMatchMode,
      'tertiaryStat',
      'tertiaryStats',
      'tertiaryStatMatchMode',
    ),
    ...draftCriterionToRule(
      draft.tuningStatValues,
      draft.tuningStatMatchMode,
      'tuningStat',
      'tuningStats',
      'tuningStatMatchMode',
    ),
    ...draftCriterionToRule(
      draft.armorSlotValues,
      draft.armorSlotMatchMode,
      'armorSlot',
      'armorSlots',
      'armorSlotMatchMode',
    ),
    ...draftCriterionToRule(
      draft.armorSetHashValues,
      draft.armorSetHashMatchMode,
      'armorSetHash',
      'armorSetHashes',
      'armorSetHashMatchMode',
    ),
  });
}

function MatchModeSelect({
  value,
  onChange,
  id,
  disabled = false,
}: {
  value: AutoFilterMatchMode;
  onChange: (mode: AutoFilterMatchMode) => void;
  id: string;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as AutoFilterMatchMode)}
      className={[
        'bg-surface border border-border rounded-md px-2 py-1.5 text-xs shrink-0 w-[5.75rem]',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
      aria-label={disabled ? 'Match mode (pick a value first)' : 'Match mode'}
    >
      <option value={IS}>Is</option>
      <option value={NOT}>Is not</option>
      <option value={ANY_OF}>Any of</option>
      <option value={NONE_OF}>None of</option>
    </select>
  );
}

function MultiValueField<T extends string | number>({
  label,
  values,
  matchMode,
  onValuesChange,
  onMatchModeChange,
  matchModeId,
  options,
  getOptionLabel,
  anyLabel = 'Any',
}: {
  label: string;
  values: T[];
  matchMode: AutoFilterMatchMode;
  onValuesChange: (values: T[]) => void;
  onMatchModeChange: (mode: AutoFilterMatchMode) => void;
  matchModeId: string;
  options: T[];
  getOptionLabel: (value: T) => string;
  anyLabel?: string;
}) {
  const isMulti = isMultiMatchMode(matchMode);
  const hasValues = values.length > 0;
  const availableOptions = options.filter((option) => !values.includes(option));

  function handleMatchModeChange(nextMode: AutoFilterMatchMode) {
    if (!isMultiMatchMode(nextMode) && values.length > 1) {
      onValuesChange(values.slice(0, 1));
    }
    onMatchModeChange(nextMode);
  }

  function addValue(value: T) {
    if (values.includes(value)) return;
    onValuesChange([...values, value]);
  }

  function removeValue(value: T) {
    const next = values.filter((entry) => entry !== value);
    onValuesChange(next);
    if (next.length === 0) onMatchModeChange(IS);
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-muted text-xs">{label}</span>
      <div className="flex gap-2 min-w-0">
        <MatchModeSelect
          id={matchModeId}
          value={matchMode}
          onChange={handleMatchModeChange}
          disabled={!hasValues}
        />
        {isMulti ? (
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {hasValues && (
              <div className="flex flex-wrap gap-1">
                {values.map((value) => (
                  <span
                    key={String(value)}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-xs"
                  >
                    {getOptionLabel(value)}
                    <button
                      type="button"
                      onClick={() => removeValue(value)}
                      className="text-muted hover:text-white"
                      aria-label={`Remove ${getOptionLabel(value)}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <select
              value=""
              onChange={(e) => {
                const raw = e.target.value;
                if (!raw) return;
                addValue((typeof options[0] === 'number' ? Number(raw) : raw) as T);
              }}
              className="bg-surface border border-border rounded-md px-2 py-1.5 min-w-0 w-full text-sm"
            >
              <option value="">{hasValues ? 'Add value…' : 'Pick a value…'}</option>
              {availableOptions.map((option) => (
                <option key={String(option)} value={String(option)}>
                  {getOptionLabel(option)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <select
            value={values[0] !== undefined ? String(values[0]) : ''}
            onChange={(e) => {
              const raw = e.target.value;
              if (!raw) {
                onValuesChange([]);
                onMatchModeChange(IS);
                return;
              }
              const value = (typeof options[0] === 'number' ? Number(raw) : raw) as T;
              onValuesChange([value]);
            }}
            className="bg-surface border border-border rounded-md px-2 py-1.5 min-w-0 flex-1"
          >
            <option value="">{anyLabel}</option>
            {options.map((option) => (
              <option key={String(option)} value={String(option)}>
                {getOptionLabel(option)}
              </option>
            ))}
          </select>
        )}
      </div>
    </label>
  );
}

function AutoFilterIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function RuleToggle({
  enabled,
  onChange,
  label,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={`${enabled ? 'Disable' : 'Enable'} rule: ${label}`}
      onClick={() => onChange(!enabled)}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors',
        enabled
          ? 'bg-white'
          : 'border border-border bg-white/5 hover:border-white/20',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-0.5 left-0.5 h-4 w-4 rounded-full transition-transform',
          enabled ? 'translate-x-4 bg-surface' : 'translate-x-0 bg-muted',
        ].join(' ')}
      />
    </button>
  );
}

export function AutoFilterRulesSection() {
  const { profile, updateProfile } = usePrefsStore();
  const allItems = useVaultStore((s) => s.allItems);
  const pendingTags = useSessionStore((s) => s.pendingTags);
  const bucketJunkedIds = useSessionStore((s) => s.bucketJunkedIds);
  const bucketKeptBothIds = useSessionStore((s) => s.bucketKeptBothIds);
  const bucketKeptSideIds = useSessionStore((s) => s.bucketKeptSideIds);

  const rules = profile.autoFilterRules ?? [];
  const [draft, setDraft] = useState<DraftRule>(emptyDraft);

  const setNameByHash = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of allItems) {
      if (item.armorSet) map.set(item.armorSet.hash, item.armorSet.name);
    }
    return map;
  }, [allItems]);

  const vaultSets = useMemo(() => {
    const classItems =
      draft.classType === 'all'
        ? allItems
        : allItems.filter((i) => i.classType === draft.classType);
    return calibrationSetPieces(classItems).map((piece) => ({
      hash: piece.armorSet!.hash,
      name: piece.armorSet!.name,
    }));
  }, [allItems, draft.classType]);

  const exclusions = useMemo(
    () => ({
      bucketJunkedIds,
      bucketKeptBothIds,
      bucketKeptSideIds,
      pendingTags,
    }),
    [bucketJunkedIds, bucketKeptBothIds, bucketKeptSideIds, pendingTags],
  );

  const liveMatchCount = useMemo(
    () => countAutoFilterMatches(allItems, rules, exclusions),
    [allItems, rules, exclusions],
  );

  function describeRule(rule: AutoFilterRule) {
    return describeAutoFilterRule(rule, setNameByHash);
  }

  function updateRules(next: AutoFilterRule[]) {
    updateProfile((p) => ({ ...p, autoFilterRules: next }));
  }

  function addRule() {
    updateRules([...rules, draftToRule(draft)]);
    setDraft(emptyDraft());
  }

  return (
    <section id="auto-filters" className="mb-10 max-w-xl space-y-3 scroll-mt-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase text-muted mb-3">
        <AutoFilterIcon className="text-muted shrink-0" />
        Rules
      </h2>
      <p className="text-xs text-muted">
        Matching pieces are queued as junk in Review (same as manual junk). Keeps are never
        auto-tagged: DIM keep/favorite, pending keep, or pieces you kept in a duel bucket. Each
        filter can be <span className="text-white/80">Is</span>,{' '}
        <span className="text-white/80">Is not</span>, <span className="text-white/80">Any of</span>
        , or <span className="text-white/80">None of</span> (e.g. junk Hunter pieces whose archetype
        is none of Bulwark, Paragon).
      </p>

      {rules.length === 0 ? (
        <p className="text-sm text-muted">No rules yet.</p>
      ) : (
        <ul className="space-y-2">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 border border-border rounded-lg px-3 py-2 bg-surface-2 text-sm"
            >
              <AutoFilterIcon
                className={rule.enabled ? 'text-white/50 shrink-0' : 'text-muted/60 shrink-0'}
              />
              <RuleToggle
                enabled={rule.enabled}
                label={describeRule(rule)}
                onChange={(enabled) =>
                  updateRules(
                    rules.map((r) => (r.id === rule.id ? { ...r, enabled } : r)),
                  )
                }
              />
              <span
                className={[
                  'min-w-0 flex-1',
                  rule.enabled ? 'text-white' : 'text-muted',
                ].join(' ')}
              >
                {describeRule(rule)}
              </span>
              <button
                type="button"
                onClick={() => updateRules(rules.filter((r) => r.id !== rule.id))}
                className="text-xs text-danger/80 hover:underline ml-auto"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border border-border rounded-lg p-4 bg-surface-2 space-y-3">
        <p className="text-xs font-semibold uppercase text-muted">Add rule</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-muted text-xs">Class</span>
            <select
              value={draft.classType}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  classType: e.target.value as AutoFilterClassScope,
                  armorSetHashValues: [],
                }))
              }
              className="bg-surface border border-border rounded-md px-2 py-1.5"
            >
              {CLASSES.map((c) => (
                <option key={c} value={c}>
                  {CLASS_LABELS[c]}
                </option>
              ))}
              <option value="all">All classes</option>
            </select>
          </label>
          <MultiValueField
            label="Archetype"
            values={draft.archetypeValues}
            matchMode={draft.archetypeMatchMode}
            matchModeId="draft-archetype-mode"
            options={ARCHETYPES}
            getOptionLabel={(value) => ARCHETYPE_LABELS[value]}
            onValuesChange={(archetypeValues) => setDraft((d) => ({ ...d, archetypeValues }))}
            onMatchModeChange={(archetypeMatchMode) =>
              setDraft((d) => ({ ...d, archetypeMatchMode }))
            }
          />
          <MultiValueField
            label="Tertiary stat"
            values={draft.tertiaryStatValues}
            matchMode={draft.tertiaryStatMatchMode}
            matchModeId="draft-tertiary-mode"
            options={STATS}
            getOptionLabel={(value) => STAT_LABELS[value]}
            onValuesChange={(tertiaryStatValues) => setDraft((d) => ({ ...d, tertiaryStatValues }))}
            onMatchModeChange={(tertiaryStatMatchMode) =>
              setDraft((d) => ({ ...d, tertiaryStatMatchMode }))
            }
          />
          <MultiValueField
            label="Tuning stat"
            values={draft.tuningStatValues}
            matchMode={draft.tuningStatMatchMode}
            matchModeId="draft-tuning-mode"
            options={STATS}
            getOptionLabel={(value) => STAT_LABELS[value]}
            onValuesChange={(tuningStatValues) => setDraft((d) => ({ ...d, tuningStatValues }))}
            onMatchModeChange={(tuningStatMatchMode) =>
              setDraft((d) => ({ ...d, tuningStatMatchMode }))
            }
          />
          <MultiValueField
            label="Slot"
            values={draft.armorSlotValues}
            matchMode={draft.armorSlotMatchMode}
            matchModeId="draft-slot-mode"
            options={ARMOR_SLOTS}
            getOptionLabel={(value) => SLOT_LABELS[value]}
            onValuesChange={(armorSlotValues) => setDraft((d) => ({ ...d, armorSlotValues }))}
            onMatchModeChange={(armorSlotMatchMode) =>
              setDraft((d) => ({ ...d, armorSlotMatchMode }))
            }
          />
          <MultiValueField
            label="Armor set"
            values={draft.armorSetHashValues}
            matchMode={draft.armorSetHashMatchMode}
            matchModeId="draft-set-mode"
            options={vaultSets.map((set) => set.hash)}
            getOptionLabel={(hash) => vaultSets.find((set) => set.hash === hash)?.name ?? `Set ${hash}`}
            onValuesChange={(armorSetHashValues) => setDraft((d) => ({ ...d, armorSetHashValues }))}
            onMatchModeChange={(armorSetHashMatchMode) =>
              setDraft((d) => ({ ...d, armorSetHashMatchMode }))
            }
          />
        </div>
        <button
          type="button"
          onClick={addRule}
          className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-white/5"
        >
          Add rule
        </button>
      </div>

      {allItems.length > 0 && rules.some((r) => r.enabled) && (
        <p className="text-xs text-muted pt-2 border-t border-border">
          Live preview: {liveMatchCount} piece{liveMatchCount === 1 ? '' : 's'} would be queued on
          next vault load (excluding keeps, favorites, and already junked).
        </p>
      )}
    </section>
  );
}
