import { test, expect } from '@playwright/test';
import { fixtures } from '../../shared-fixtures/wine-retail.js';

test('debug items', async ({ page }) => {
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

  await page.goto('/items');
  await page.waitForTimeout(800);
  console.log('1: on items page');
  await page.locator('input[placeholder="New item name"]').fill('Debug Item');
  console.log('2: filled name');
  const options = await page.locator('select').first().locator('option').allTextContents();
  console.log('3: options available:', JSON.stringify(options));
  await page.locator('select').first().selectOption({ label: '+ New category…' });
  console.log('4: selected new category option');
  await page.waitForTimeout(300);
  const catInputCount = await page.locator('input[placeholder="New category name, e.g. Pinot Noir"]').count();
  console.log('5: category input count:', catInputCount);
  const style = await page.locator('input[placeholder="New category name, e.g. Pinot Noir"]').evaluate((el) => {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return { display: cs.display, visibility: cs.visibility, width: rect.width, height: rect.height, opacity: cs.opacity };
  });
  console.log('5b: computed style:', JSON.stringify(style));
  const parentStyle = await page.locator('.new-category-form').evaluate((el) => {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return { display: cs.display, width: rect.width, flexBasis: cs.flexBasis, flexGrow: cs.flexGrow };
  });
  console.log('5c: .new-category-form style:', JSON.stringify(parentStyle));
  const grandparentStyle = await page.locator('.add-item').evaluate((el) => {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return { display: cs.display, width: rect.width, flexWrap: cs.flexWrap };
  });
  console.log('5d: .add-item style:', JSON.stringify(grandparentStyle));
  await page.screenshot({ path: '/tmp/debug_items_state.png', fullPage: true });
  await page.locator('input[placeholder="New category name, e.g. Pinot Noir"]').fill('Debug Category');
  console.log('6: filled category name');
  await page.getByRole('button', { name: '+ Add' }).click();
  console.log('7: clicked add');
  await page.waitForTimeout(1000);
  console.log('8: done, still alive');
});
