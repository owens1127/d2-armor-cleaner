/** Blocks vault apply/background refresh while the user is clicking or a menu is open. */

let pointerActive = false;
let interactionHolds = 0;
const unblockListeners = new Set<() => void>();

export function isVaultRefreshBlocked(): boolean {
  return pointerActive || interactionHolds > 0;
}

export function retainVaultInteraction(): void {
  interactionHolds += 1;
}

export function releaseVaultInteraction(): void {
  interactionHolds = Math.max(0, interactionHolds - 1);
  notifyVaultRefreshUnblocked();
}

/** Run `cb` now if unblocked, otherwise once after the next unblock. Returns cancel. */
export function whenVaultRefreshUnblocked(cb: () => void): () => void {
  if (!isVaultRefreshBlocked()) {
    cb();
    return () => {};
  }
  unblockListeners.add(cb);
  return () => {
    unblockListeners.delete(cb);
  };
}

function notifyVaultRefreshUnblocked(): void {
  if (isVaultRefreshBlocked()) return;
  const pending = [...unblockListeners];
  unblockListeners.clear();
  for (const cb of pending) {
    try {
      cb();
    } catch {
      /* listener errors should not break other deferred work */
    }
  }
}

/** Install global pointer tracking (call once from Layout). */
export function installVaultRefreshGuard(): () => void {
  const onPointerDown = () => {
    pointerActive = true;
  };
  const onPointerUp = () => {
    if (!pointerActive) return;
    pointerActive = false;
    notifyVaultRefreshUnblocked();
  };
  window.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('pointerup', onPointerUp, true);
  window.addEventListener('pointercancel', onPointerUp, true);
  return () => {
    window.removeEventListener('pointerdown', onPointerDown, true);
    window.removeEventListener('pointerup', onPointerUp, true);
    window.removeEventListener('pointercancel', onPointerUp, true);
    pointerActive = false;
    interactionHolds = 0;
    unblockListeners.clear();
  };
}

/** For tests. */
export function resetVaultRefreshGuard(): void {
  pointerActive = false;
  interactionHolds = 0;
  unblockListeners.clear();
}
