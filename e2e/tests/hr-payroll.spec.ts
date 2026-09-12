import { test, expect } from '@playwright/test';
import fixtures from '../../shared-fixtures/wine-retail.json' with { type: 'json' };
import { login } from './helpers.js';

test('HR/Payroll: pays a real hourly employee and a real salaried one, with real Medicare/superannuation math, and shows the real org chart', async ({ page }) => {
  await login(page);
  await page.locator('select').first().selectOption({ label: fixtures.business });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  await page.goto('/hr');
  await page.waitForTimeout(700);

  // Pay a real, hourly employee — 38.5 hours at their own real, configured rate.
  const empSelect = page.locator('.form-card select').first();
  await empSelect.selectOption({ label: 'Chloe Ferraro' });
  await page.waitForTimeout(500);
  await expect(page.locator('.pay-rate')).toContainText('28.50');
  await page.locator('input[placeholder="e.g. 38.5"]').fill('38.5');
  await page.getByRole('button', { name: 'Pay employee' }).click();
  await page.waitForTimeout(1000);
  const hourlyResult = page.locator('.pay-result');
  await expect(hourlyResult).toContainText('1 097.25'); // 38.5 * $28.50
  await expect(hourlyResult).toContainText('16.46'); // 1.5% Medicare levy
  await expect(hourlyResult).toContainText('131.67'); // 12% superannuation
  await expect(hourlyResult).toContainText('1 080.79'); // net

  // Pay a real, salaried employee — one real month, no hours field at all.
  await empSelect.selectOption({ label: 'Isla Fairweather' });
  await page.waitForTimeout(500);
  await expect(page.locator('.pay-rate')).toContainText('7 333.33'); // $88,000 / 12
  await expect(page.locator('input[placeholder="e.g. 38.5"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Pay employee' }).click();
  await page.waitForTimeout(1000);
  const salariedResult = page.locator('.pay-result');
  await expect(salariedResult).toContainText('7 333.33');

  // The real org chart — company-wide staff separated from real, per-location staff.
  await page.getByRole('button', { name: 'Org Chart' }).click();
  await page.waitForTimeout(700);
  await expect(page.locator('.org-section').first()).toContainText('Company-wide staff');
  await expect(page.locator('.org-section').first()).toContainText('Isla Fairweather');
  await expect(page.getByRole('heading', { name: 'Riverside Cellars' })).toBeVisible();
  await expect(page.getByText('Chloe Ferraro').last()).toBeVisible();
});
