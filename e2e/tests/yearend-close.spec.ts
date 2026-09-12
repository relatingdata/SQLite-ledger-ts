import { test, expect } from '@playwright/test';
import { fixtures } from '../../shared-fixtures/wine-retail.js';
import { login } from './helpers.js';

test('Year End Close: posts a real, unclosed expense through the real General Journal, closes it, and shows the real, honest error on a second attempt', async ({ page }) => {
  await login(page);
  await page.locator('select').first().selectOption({ label: fixtures.business });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  // A real, small, genuinely unclosed expense — posted through the
  // real General Journal UI, not a direct backend call, so this test
  // is fully self-contained and doesn't depend on any external setup
  // having already run.
  const reference = `YEC-TEST-${Date.now()}`;
  await page.goto('/post');
  await page.waitForSelector('table');
  await page.waitForTimeout(500);
  await page.locator('input[placeholder="e.g. GJ-1001"]').fill(reference);

  async function selectAccountContaining(select: ReturnType<typeof page.locator>, text: string) {
    const options = await select.locator('option').allTextContents();
    const match = options.find((o) => o.includes(text));
    if (!match) throw new Error(`No real account option containing "${text}" found.`);
    await select.selectOption({ label: match });
  }

  const firstRow = page.locator('tbody tr').first();
  await selectAccountContaining(firstRow.locator('select'), 'Rent');
  await firstRow.locator('input.num').first().fill('500.00');
  await page.waitForTimeout(300);

  const secondRow = page.locator('tbody tr').nth(1);
  await selectAccountContaining(secondRow.locator('select'), 'Cash and Bank');
  await secondRow.locator('input.num').nth(1).fill('500.00');
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(1000);

  // Now close the books — a real, complete flow through the actual
  // UI: preview the real, proposed entry first, then accept it.
  await page.goto('/setup/yearend');
  await page.waitForTimeout(800);

  const previewBtn = page.getByRole('button', { name: 'Preview the close' });
  await previewBtn.click();
  await page.waitForTimeout(1200);

  const previewTable = page.locator('.preview-table');
  await expect(previewTable).toBeVisible();
  await expect(previewTable).toContainText('Rent');
  await expect(previewTable).toContainText("Owner's Equity");

  const acceptBtn = page.getByRole('button', { name: 'Accept and close' });
  await acceptBtn.click();
  await page.waitForTimeout(1200);

  const result = page.locator('.close-result');
  await expect(result).toBeVisible();
  await expect(result).toContainText('Accounts zeroed');

  // A real, second attempt on the same, already-closed date must show
  // the real, honest backend error at the preview step, not silently
  // succeed again. Re-navigating is a real, clean way to get back to
  // a fresh preview step, since a successful close's own result view
  // doesn't currently offer a "try again" action directly. The page's
  // own default (today's date) is used both times, matching what the
  // first close actually used.
  await page.goto('/setup/yearend');
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Preview the close' }).click();
  await page.waitForTimeout(1000);
  await expect(page.locator('.error')).toContainText('Nothing to close');
});
