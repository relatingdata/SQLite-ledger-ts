import { test, expect } from '@playwright/test';
import { fixtures } from '../../shared-fixtures/wine-retail.js';

test('debug journal', async ({ page }) => {
  test.setTimeout(30000);
  page.on('requestfailed', (req) => console.log('REQ FAILED:', req.method(), req.url()));
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

  await page.goto('/login');
  await page.waitForTimeout(500);
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('changeme123');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'));
  await page.locator('select').first().selectOption({ label: fixtures.business });
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  await page.goto('/setup/new-business');
  await page.waitForTimeout(500);
  await page.locator('input[placeholder="e.g. Corner Store Pty Ltd"]').fill('Debug Co J');
  await page.locator('input[placeholder="e.g. 2026-27"]').fill('2026-27');
  await page.getByRole('button', { name: 'Create Business' }).click();
  await page.waitForTimeout(1500);

  await page.goto('/session');
  await page.waitForTimeout(500);
  await page.locator('select').first().selectOption({ label: 'Debug Co J' });
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');
  console.log('A: session switched to new business');

  await page.goto('/post');
  await page.waitForTimeout(800);
  console.log('B: on post page');
  const options = await page.locator('tbody tr').first().locator('select').locator('option').allTextContents();
  console.log('C: account options count:', options.length);
  console.log('D: includes Cash and Bank:', options.some((o) => o.includes('Cash and Bank')));
  console.log('E: includes Owner:', options.some((o) => o.includes('Owner')));
  console.log('F: first 10 options:', JSON.stringify(options.slice(0, 10)));
});
