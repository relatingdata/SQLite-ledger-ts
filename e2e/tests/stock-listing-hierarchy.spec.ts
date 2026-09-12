import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

test('stock listing groups real stock by real division and location, both collapsible', async ({ page }) => {
  await login(page);
  await page.locator('select').first().selectOption({ label: 'Wine Retail Company' });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  await page.goto('/stock/listing');
  await page.waitForSelector('.grid-box', { timeout: 8000 });

  // Every location now has its own, real, specific division (per-location
  // divisions, added after this test was first written) — Head Office's
  // own division is present, collapsed by default, real product rows not
  // yet visible.
  await expect(page.locator('.division-head', { hasText: 'Head Office Division' })).toBeVisible();
  await expect(page.locator('.division-head', { hasText: 'Warehouse B Division' })).toBeVisible();
  await expect(page.locator('text=Amber Ale 330ml')).toHaveCount(0);

  // Expanding Head Office Division reveals its own real location, not Warehouse B's.
  await page.locator('.division-head', { hasText: 'Head Office Division' }).click();
  await expect(page.locator('.location-head', { hasText: 'Head Office' })).toBeVisible();
  await expect(page.locator('.location-head', { hasText: 'Warehouse B' })).toHaveCount(0);

  // Expanding a location reveals its real products with editable levels.
  await page.locator('.location-head', { hasText: 'Head Office' }).click();
  const row = page.locator('tr', { hasText: 'Amber Ale 330ml' });
  await expect(row).toBeVisible();
  const minInput = row.locator('input').first();
  await minInput.fill('42');
  await minInput.blur();
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForSelector('.grid-box', { timeout: 8000 });
  await page.locator('.division-head', { hasText: 'Head Office Division' }).click();
  await page.locator('.location-head', { hasText: 'Head Office' }).click();
  await expect(page.locator('tr', { hasText: 'Amber Ale 330ml' }).locator('input').first()).toHaveValue('42');
});
