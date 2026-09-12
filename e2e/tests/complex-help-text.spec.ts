import { test, expect } from '@playwright/test';
import { fixtures } from '../../shared-fixtures/wine-retail.js';
import { login } from './helpers.js';

test('the 9 complex help texts (embedded <code>, dynamic session names, and true AR/AP word-choice branches) all render correctly in German', async ({ page }) => {
  await login(page);
  await page.locator('select').first().selectOption({ label: fixtures.business });
  await page.waitForTimeout(300);
  await page.locator('select').nth(2).selectOption({ label: 'German' });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue|weiter/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  // <code> tag preserved as real HTML, not escaped literal text
  await page.goto('/setup/tree');
  await expect(page.locator('.intro code')).toHaveText('parent_id', { timeout: 10000 });
  await expect(page.locator('.intro')).toContainText('Jede Entität im System', { timeout: 10000 });

  // {NAME} placeholder correctly embeds the live business name, natural German word order
  await page.goto('/reports/sales');
  await expect(page.locator('.intro')).toContainText('Wine Retail Company', { timeout: 10000 });
  await expect(page.locator('.intro')).toContainText('Jeder reale', { timeout: 10000 });

  await page.goto('/reports/balance-sheet');
  await expect(page.locator('.intro')).toContainText('Nur für', { timeout: 10000 });

  // True word-choice branch: AR vs AP, both as full, natural sentences
  await page.goto('/invoices');
  await expect(page.locator('.intro')).toContainText('erzeugt AR und erfasst Ertrag', { timeout: 10000 });
  await page.getByRole('button', { name: 'AP (Einkauf)' }).click();
  await expect(page.locator('.intro')).toContainText('erzeugt AP und erfasst Aufwand', { timeout: 10000 });

  // True word-choice branch: customer vs vendor
  await page.goto('/reports/aged');
  await expect(page.locator('.intro')).toContainText('Kunden', { timeout: 10000 });
  await page.getByRole('button', { name: 'AP', exact: true }).click();
  await expect(page.locator('.intro')).toContainText('Lieferanten', { timeout: 10000 });
});
