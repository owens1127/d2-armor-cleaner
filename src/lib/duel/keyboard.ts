export const DUEL_KEY_LABELS = {
  keepLeft: 'Shift+←',
  keepBoth: '↑',
  keepRight: 'Shift+→',
  preferLeft: '←',
  pass: 'Space',
  preferRight: '→',
  junkLeft: 'Ctrl+←',
  junkBoth: '↓',
  junkRight: 'Ctrl+→',
} as const;

export interface DuelKeyboardActions {
  pickLeft: () => void;
  pickRight: () => void;
  passPair: () => void;
  keepLeft: () => void;
  keepRight: () => void;
  keepBoth: () => void;
  junkLeft: () => void;
  junkRight: () => void;
  junkBoth: () => void;
  skipBucket: () => void;
  undoLast: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const tag = (target as { tagName?: string }).tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA';
}

/** Returns true when a duel/global shortcut was handled. */
export function handleDuelKeyDown(
  e: KeyboardEvent,
  actions: DuelKeyboardActions,
  options: { duelActive: boolean; resolving: boolean },
): boolean {
  if (options.resolving || isTypingTarget(e.target)) return false;

  if (e.key === 's' || e.key === 'S') {
    actions.skipBucket();
    return true;
  }
  if (e.key === 'u' || e.key === 'U') {
    actions.undoLast();
    return true;
  }

  if (!options.duelActive) return false;

  const shift = e.shiftKey;
  const ctrl = e.ctrlKey;

  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    if (ctrl) actions.junkLeft();
    else if (shift) actions.keepLeft();
    else actions.pickLeft();
    return true;
  }
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    if (ctrl) actions.junkRight();
    else if (shift) actions.keepRight();
    else actions.pickRight();
    return true;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    actions.keepBoth();
    return true;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    actions.junkBoth();
    return true;
  }
  if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault();
    actions.passPair();
    return true;
  }

  return false;
}
