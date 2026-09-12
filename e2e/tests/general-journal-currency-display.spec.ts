import { test, expect } from '@playwright/test';
import fixtures from '../../shared-fixtures/wine-retail.json' with { type: 'json' };
import { login } from './helpers.js';

test('General Journal account dropdown shows each account\'s real currency', async ({ page }) => {
  await login(page);
  await page.locator('select').first().selectOption({ label: fixtures.business });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  await page.goto('/post');
  await page.waitForSelector('table');
  await page.waitForTimeout(500);

  const options = await page.locator('tbody tr').first().locator('select option').allTextContents();
  const dkk = options.find((o) => o.includes('Bank Account (DKK)'));
  const eur = options.find((o) => o.includes('Bank Account (EUR)'));
  console.log('DKK option:', dkk);
  console.log('EUR option:', eur);
  expect(dkk).toContain('(DKK)');
  expect(eur).toContain('(EUR)');

  const cash = options.find((o) => o.includes('Cash and Bank'));
  console.log('Home-currency Cash and Bank option (should have no suffix):', cash);
  expect(cash).not.toContain('(');
});
