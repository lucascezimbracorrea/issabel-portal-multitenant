import { test, expect } from '@playwright/test';

test('login page loads', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
});

test('unauthenticated redirect to login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/login/, { timeout: 15_000 });
});
