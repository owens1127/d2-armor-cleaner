import { test, expect } from '@playwright/test';

test.describe('home page (no auth)', () => {
  test('loads landing page and shows sign-in workflow', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'D2 Armor Cleaner' })).toBeVisible();
    await expect(page.getByText('Sign in', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Compare', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Review', { exact: true }).first()).toBeVisible();
  });

  test('shows workflow steps on landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'How it works' })).toBeVisible();
    await expect(page.getByText('Calibrate').first()).toBeVisible();
    await expect(page.getByText('Browse').first()).toBeVisible();
  });
});
