import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

test('entering both debit and credit on one line clears the opposite field — a real, reported bug: it previously silently posted debit-minus-credit as a net amount instead of rejecting the invalid input', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  await page.goto('/post');
  await page.waitForSelector('table');

  const firstRowDebit = page.locator('tbody tr').first().locator('input.num').first();
  const firstRowCredit = page.locator('tbody tr').first().locator('input.num').nth(1);

  await firstRowDebit.fill('100.00');
  await expect(firstRowDebit).toHaveValue('100.00');

  await firstRowCredit.fill('50.00');
  await expect(firstRowCredit).toHaveValue('50.00');
  await expect(firstRowDebit).toHaveValue('', { timeout: 2000 });
});
