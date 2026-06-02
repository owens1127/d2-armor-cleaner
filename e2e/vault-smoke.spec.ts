import { expect, test } from '@playwright/test';
import { E2E_SKIP_MESSAGE, hasE2eBungieAuth } from './bungie-auth';
import { authenticateLiveVault, waitForLiveVaultReady } from './helpers';

test.describe('live Bungie vault', () => {
  test.beforeEach(({ }, testInfo) => {
    test.skip(!hasE2eBungieAuth(), E2E_SKIP_MESSAGE);
  });

  test('loads vault and shows onboarding with real piece count', async ({ page }) => {
    await authenticateLiveVault(page);
    await waitForLiveVaultReady(page);

    await expect(
      page.getByRole('heading', { name: /How should duplicates match/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/About \d+ duplicate|No duplicate groups|roughly \d+ roll/),
    ).toBeVisible();
  });

  test('loads vault and reaches dashboard when onboarding is complete', async ({ page }) => {
    await authenticateLiveVault(page, { onboardingComplete: true });
    await waitForLiveVaultReady(page);

    await expect(page.getByRole('heading', { name: /Hunter vault/i })).toBeVisible();
    await expect(page.getByText(/\d+ Edge of Fate armor \(account\)/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Compare', exact: true })).toBeVisible();
  });

  test('browse all shows live armor list', async ({ page }) => {
    await authenticateLiveVault(page, { onboardingComplete: true });
    await waitForLiveVaultReady(page);

    await page.getByRole('link', { name: 'Browse all' }).click();
    await expect(page.getByRole('heading', { name: /Browse Hunter armor/i })).toBeVisible({
      timeout: 30_000,
    });
  });
});
