import type { Page } from '@playwright/test';

/** Logs in as the real, default admin user — every test needs this
 * first, so it lives in one place rather than copy-pasted three
 * times. */
export async function login(page: Page) {
  await page.goto('/login');
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('changeme123');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'));
}
