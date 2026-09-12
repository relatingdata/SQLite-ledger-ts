import { test, expect } from '@playwright/test';

test('debug shelf2', async ({ page }) => {
  test.setTimeout(30000);
  page.on('requestfinished', async (req) => {
    if (req.url().includes('/api/locations')) {
      const res = await req.response();
      console.log('REQ DONE:', req.method(), req.url().replace('http://localhost:3001', ''), '->', res?.status());
    }
  });
  page.on('requestfailed', (req) => console.log('REQ FAILED:', req.method(), req.url()));

  await page.goto('/login');
  await page.waitForTimeout(500);
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('changeme123');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'));
  await page.locator('select').first().selectOption({ label: 'Wine Retail Company' });
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  await page.goto('/setup/new-business');
  await page.waitForTimeout(500);
  await page.locator('input[placeholder="e.g. Corner Store Pty Ltd"]').fill('Debug Co 3');
  await page.locator('input[placeholder="e.g. 2026-27"]').fill('2026-27');
  await page.getByRole('button', { name: 'Create Business' }).click();
  await page.waitForTimeout(1500);

  await page.goto('/session');
  await page.waitForTimeout(500);
  await page.locator('select').first().selectOption({ label: 'Debug Co 3' });
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  await page.goto('/locations');
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '+ New Location' }).click();
  await page.locator('input[placeholder="Location name, e.g. Downtown Cellar"]').fill('Debug Loc');
  await page.locator('input[placeholder="City"]').fill('Adelaide');
  await page.locator('.new-location-form select').first().selectOption('Retail');
  console.log('1: about to click create');
  await page.getByRole('button', { name: 'Create' }).click();
  console.log('2: clicked create');
  await page.waitForTimeout(1000);
  console.log('3: filling shelf');
  await page.locator('input[placeholder="e.g. 2000"]').fill('2000');
  console.log('4: filled shelf, clicking save');
  await page.getByRole('button', { name: 'Save' }).click();
  console.log('5: clicked save');
  await page.waitForTimeout(1000);
  console.log('6: done, still alive');
});
