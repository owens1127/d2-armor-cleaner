import { expect, type Page } from '@playwright/test';
import {
  createBungieSession,
  injectBungieSession,
  type BungieSession,
} from './bungie-auth';

let cachedSession: BungieSession | null = null;

export async function getLiveBungieSession(): Promise<BungieSession> {
  if (!cachedSession) cachedSession = await createBungieSession();
  return cachedSession;
}

/** Authenticate via refresh token and open the app with a restored Bungie session. */
export async function authenticateLiveVault(page: Page, options?: { onboardingComplete?: boolean }) {
  const session = await getLiveBungieSession();
  await injectBungieSession(page, session);

  if (options?.onboardingComplete) {
    await page.addInitScript(() => {
      localStorage.setItem('dac-onboarding', 'true');
    });
  }

  await page.goto('/');
}

/** Wait until live vault load finishes (onboarding or dashboard). */
export async function waitForLiveVaultReady(page: Page) {
  const onboarding = page.getByRole('heading', { name: /How should duplicates match/i });
  const dashboard = page.getByRole('heading', { name: /Hunter vault/i });

  await expect(onboarding.or(dashboard)).toBeVisible({ timeout: 180_000 });

  await expect(
    page.getByText(
      /\d+ Edge of Fate armor \(account\)|About \d+ duplicate|No duplicate groups/,
    ),
  ).toBeVisible({ timeout: 180_000 });
}
