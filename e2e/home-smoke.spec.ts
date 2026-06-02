import { test, expect } from '@playwright/test';

test.describe('home page (no auth)', () => {
  test('loads landing page and shows sign-in CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'D2 Armor Cleaner' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Sign in with Bungie' }).first(),
    ).toBeVisible();
    await expect(
      page.getByText('Nothing is dismantled here', { exact: false }).first(),
    ).toBeVisible();
  });

  test('shows footer note on landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Sign out in Settings', { exact: false }).first()).toBeVisible();
  });
});
