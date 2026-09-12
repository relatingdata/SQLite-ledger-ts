import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

test('P&L division picker shows the real, nested hierarchy — Consolidated -> city division -> location division, any level directly selectable', async ({ page }) => {
  await login(page);
  await page.locator('select').first().selectOption({ label: 'Wine Retail Company' });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  await page.goto('/reports/profit-and-loss');
  await page.waitForSelector('.report', { timeout: 8000 });
  await page.waitForTimeout(500);

  // Consolidated is the default, shown on the current-selection button.
  await expect(page.locator('.current')).toContainText('Consolidated');

  await page.locator('.current').click();
  await page.waitForTimeout(300);

  // The real hierarchy is visible: both cities, and a real, nested location under one of them.
  await expect(page.getByRole('button', { name: 'Springfield', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rivertown', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Head Office', exact: true })).toBeVisible();

  // Selecting a real, nested location directly (not just a top-level city) works.
  await page.getByRole('button', { name: 'Riverside Cellars', exact: true }).click();
  await page.waitForTimeout(700);
  await expect(page.locator('.current')).toContainText('Riverside Cellars');

  // The real title block shows the division above the company name, per direct request.
  await expect(page.locator('.title-line.division')).toContainText('Riverside Cellars');
  const divisionBox = await page.locator('.title-line.division').boundingBox();
  const companyBox = await page.locator('.title-line.company').boundingBox();
  expect(divisionBox!.y).toBeLessThan(companyBox!.y);
});
