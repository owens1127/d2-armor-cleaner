import type { DesiredBuild, StatTarget } from '@/types';

/** User-editable combo fields tracked for dirty/saved state in the editor. */
export type DesiredBuildEditorSnapshot = {
  name: string;
  enabled: boolean;
  statTargets: StatTarget[];
  setBonus2pc?: number;
  setBonus4pc?: number;
};

export function desiredBuildEditorSnapshot(build: DesiredBuild): DesiredBuildEditorSnapshot {
  return {
    name: build.name.trim(),
    enabled: build.enabled !== false,
    statTargets: build.statTargets.map(({ stat, target }) => ({ stat, target })),
    setBonus2pc: build.setBonus2pc,
    setBonus4pc: build.setBonus4pc,
  };
}

export function areDesiredBuildEditsEqual(a: DesiredBuild, b: DesiredBuild): boolean {
  const left = desiredBuildEditorSnapshot(a);
  const right = desiredBuildEditorSnapshot(b);
  if (left.name !== right.name) return false;
  if (left.enabled !== right.enabled) return false;
  if (left.setBonus2pc !== right.setBonus2pc) return false;
  if (left.setBonus4pc !== right.setBonus4pc) return false;
  if (left.statTargets.length !== right.statTargets.length) return false;
  return left.statTargets.every(
    (target, index) =>
      target.stat === right.statTargets[index]?.stat &&
      target.target === right.statTargets[index]?.target,
  );
}

export function isDesiredBuildDirty(draft: DesiredBuild, saved: DesiredBuild): boolean {
  return !areDesiredBuildEditsEqual(draft, saved);
}

export function mergeDesiredBuildDraft(
  saved: DesiredBuild,
  draft: Partial<DesiredBuild>,
): DesiredBuild {
  return { ...saved, ...draft };
}

/** Single-combo edit session: at most one card in edit mode; drafts only while editing. */
export type DesiredBuildEditSession = {
  editingId: string | null;
  drafts: Record<string, DesiredBuild>;
};

export function createDesiredBuildEditSession(): DesiredBuildEditSession {
  return { editingId: null, drafts: {} };
}

export function isBuildEditing(session: DesiredBuildEditSession, buildId: string): boolean {
  return session.editingId === buildId;
}

export function startBuildEdit(
  session: DesiredBuildEditSession,
  buildId: string,
): DesiredBuildEditSession {
  const nextDrafts = { ...session.drafts };
  if (session.editingId && session.editingId !== buildId) {
    delete nextDrafts[session.editingId];
  }
  return { editingId: buildId, drafts: nextDrafts };
}

export function cancelBuildEdit(
  session: DesiredBuildEditSession,
  buildId: string,
): DesiredBuildEditSession {
  const nextDrafts = { ...session.drafts };
  delete nextDrafts[buildId];
  return {
    editingId: session.editingId === buildId ? null : session.editingId,
    drafts: nextDrafts,
  };
}

export function finishBuildEdit(
  session: DesiredBuildEditSession,
  buildId: string,
): DesiredBuildEditSession {
  const nextDrafts = { ...session.drafts };
  delete nextDrafts[buildId];
  return {
    editingId: session.editingId === buildId ? null : session.editingId,
    drafts: nextDrafts,
  };
}
