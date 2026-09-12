import { test, expect } from '@playwright/test';

test('Storage origin (Hot/Cold) displays correctly on Cash Sale through the real UI', async ({ page, request }) => {
  test.setTimeout(60000);

  // Log in first, via the real UI, to get a real session token the
  // API request below can reuse.
  await page.goto('/login');
  await page.waitForTimeout(1000);
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('changeme123');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'));
  await page.waitForTimeout(500);
  await page.locator('select').first().selectOption({ label: 'Wine Retail Company' });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');
  await page.waitForTimeout(500);

  // A real, direct backend call to log in and set a real item's own
  // storage origin explicitly to Cold, and a second, real shelf item
  // explicitly to Hot — the real, direct setup this test needs, not
  // itself the thing being verified (that's the UI check below).
  const loginResp = await request.post('http://localhost:3001/api/auth/login', {
    data: { username: 'admin', password: 'changeme123' },
  });
  const { token } = await loginResp.json();
  await request.put('http://localhost:3001/api/items/Golden Lager 330ml/storage-origin', {
    headers: { Authorization: `Bearer ${token}` },
    data: { origin: 'Cold' },
  });
  await request.put('http://localhost:3001/api/items/Barossa Shiraz 2021/storage-origin', {
    headers: { Authorization: `Bearer ${token}` },
    data: { origin: 'Hot' },
  });

  // The real, genuine check: does the actual Cash Sale UI show the
  // correct real tag for each item, through real typing, not an API
  // response?
  await page.goto('/arap/cash-sale');
  await page.waitForSelector('table.lines-table');
  await page.locator('table.lines-table input').first().fill('Golden Lager 330ml');
  await page.waitForTimeout(300);
  const secondPartInput = page.locator('table.lines-table tbody tr').nth(1).locator('input').first();
  await secondPartInput.fill('Barossa Shiraz 2021');
  await page.waitForTimeout(300);

  const firstRow = page.locator('table.lines-table tbody tr').nth(0);
  const secondRow = page.locator('table.lines-table tbody tr').nth(1);
  await expect(firstRow.locator('.storage-tag.cold')).toHaveText('Cold');
  await expect(secondRow.locator('.storage-tag.shelf')).toHaveText('Hot');

  await page.screenshot({ path: '/tmp/storage_origin_verified.png', fullPage: true });
});
