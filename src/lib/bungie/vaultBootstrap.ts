/** Module-level guard: auto vault load runs once per page session (StrictMode-safe). */
let bootstrapVaultLoadTriggered = false;

export function shouldAutoLoadVault(): boolean {
  return !bootstrapVaultLoadTriggered;
}

export function markBootstrapVaultLoadTriggered(): void {
  bootstrapVaultLoadTriggered = true;
}

export function resetBootstrapVaultLoad(): void {
  bootstrapVaultLoadTriggered = false;
}
