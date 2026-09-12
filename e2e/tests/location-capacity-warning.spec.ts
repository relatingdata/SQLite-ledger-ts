import { test, expect } from '@playwright/test';
import { fixtures } from '../../shared-fixtures/wine-retail.js';
import { login } from './helpers.js';

test('Stock Listing shows a real, visible "Over capacity" warning on a real location genuinely over its own configured capacity', async ({ page }) => {
  await login(page);
  await page.locator('select').first().selectOption({ label: fixtures.business });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  await page.goto('/stock/listing');
  await page.waitForSelector('.grid-box', { timeout: 8000 });
  await page.waitForTimeout(700);
  await page.locator('.division-head').first().click();
  await page.waitForTimeout(500);

  // Eastside Cellar Door is genuinely over its own real, configured capacity.
  const overRow = page.locator('.location-head', { hasText: 'Eastside Cellar Door' });
  await expect(overRow.locator('.capacity-warning')).toBeVisible();
  await expect(overRow.locator('.capacity-warning')).toContainText('Over capacity');

  // A real location that isn't over must show no warning at all.
  await page.locator('.division-head').nth(1).click();
  await page.waitForTimeout(500);
  const normalRow = page.locator('.location-head', { hasText: 'Harbourside Bottle Shop' });
  await expect(normalRow.locator('.capacity-warning')).toHaveCount(0);
});
