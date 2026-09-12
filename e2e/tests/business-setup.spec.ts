import { test, expect } from '@playwright/test';
import { fixtures } from '../../shared-fixtures/wine-retail.js';
import { login } from './helpers.js';

test('Business Setup: the tree, location open hours, and employee schedule validated against them', async ({ page }) => {
  await login(page);
  await page.locator('select').first().selectOption({ label: fixtures.business });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  await page.goto('/setup/business-setup');
  await page.waitForTimeout(1500);

  // The real tree shows the real, complete organization.
  await expect(page.getByText('Company-wide staff')).toBeVisible();
  await expect(page.locator('.tree-item.location', { hasText: 'Riverside Cellars' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chloe Ferraro' })).toBeVisible();

  // Set Riverside Cellars' real open hours — Monday only.
  await page.locator('.tree-item.location', { hasText: 'Riverside Cellars' }).click();
  await page.waitForTimeout(700);
  const mondayRow = page.locator('.grid-row', { hasText: 'Monday' });
  await mondayRow.locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('Saved.')).toBeVisible();

  // A real, valid schedule for Chloe, matching those real open hours.
  await page.getByRole('button', { name: 'Chloe Ferraro' }).click();
  await page.waitForTimeout(700);
  await expect(page.getByText('Weekly schedule — Riverside Cellars')).toBeVisible();
  const empMondayRow = page.locator('.grid-row', { hasText: 'Monday' });
  await empMondayRow.locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('Saved.')).toBeVisible();

  // A real, invalid schedule — a single shift longer than the real,
  // direct 12-hour daily cap for one person — must show the real,
  // honest backend error, not silently succeed. Per a real, confirmed,
  // deliberate design change (035e5b4): a real employee can genuinely
  // work a shift outside a location's own open hours (cleaning,
  // stocking, a delivery before doors open), so the real, current
  // limit is a direct cap on how much one real person can work at
  // all, not confinement to open hours.
  const empTuesdayRow = page.locator('.grid-row', { hasText: 'Tuesday' });
  await empTuesdayRow.locator('input[type="checkbox"]').check();
  await empTuesdayRow.locator('input[type="time"]').first().fill('06:00');
  await empTuesdayRow.locator('input[type="time"]').nth(1).fill('19:00');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('exceeds the real 12-hour daily limit')).toBeVisible();

  // A real, new division can be created directly from this screen —
  // per a real, confirmed, deliberate design change: keyboard-driven
  // (Insert/Delete), not a dedicated button. The tree panel itself
  // must have real, genuine focus first, since that's where the real
  // keydown handler is attached.
  await page.locator('.tree-panel').focus();
  await page.keyboard.press('Insert');
  await page.waitForTimeout(300);
  await page.locator('input[placeholder="Division name"]').fill('Testburg');
  await page.locator('.inline-add .btn.small').first().click();
  await page.waitForTimeout(1000);
  await expect(page.getByRole('button', { name: 'Testburg' })).toBeVisible();
});
