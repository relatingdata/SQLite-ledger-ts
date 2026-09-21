import { test, expect } from '@playwright/test';
import { fixtures } from '../../shared-fixtures/wine-retail.js';
import { login } from './helpers.js';

test('the General Journal account dropdown shows only accounts from the current business\'s own real CoA prototype', async ({ page }) => {
  await login(page);
  await page.locator('select').first().selectOption({ label: fixtures.business });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  await page.goto('/post');
  await page.waitForSelector('table');
  await page.waitForTimeout(500);

  const options = await page.locator('tbody tr').first().locator('select option').allTextContents();
  console.log('Total real options shown:', options.length);

  // Real, known accounts from OTHER real CoA prototypes — must never
  // appear when Wine Retail Business (English) is selected.
  const otherPrototypeAccounts = ['Bankkontokorrent', 'Umsatzerlöse', 'Disponibilités', 'Cassa e valori', 'Kasse'];
  for (const name of otherPrototypeAccounts) {
    const found = options.some((o) => o.includes(name));
    console.log(`"${name}" present:`, found);
    expect(found).toBe(false);
  }

  const cashAndBank = options.find((o) => o.includes('Cash and Bank'));
  expect(cashAndBank).toBeTruthy();
});
