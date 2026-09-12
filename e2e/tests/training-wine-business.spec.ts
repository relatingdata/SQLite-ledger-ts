import { test, expect } from '@playwright/test';

const BIZ = 'Training Wine Business';

test('Create the second, augmented Training Wine Business through the UI', async ({ page }) => {
  test.setTimeout(60000);

  // === Login ===
  await page.goto('/login');
  await page.waitForTimeout(1000);
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('changeme123');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'));
  await page.waitForTimeout(500);

  // Choose any real, existing business first — the app's own real
  // session requirement, before creating a new one.
  await page.locator('select').first().selectOption({ label: 'My Business' });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');
  await page.waitForTimeout(500);

  // === Create the second, augmented business ===
  await page.goto('/setup/new-business');
  await page.waitForTimeout(800);
  await page.locator('input[placeholder="e.g. Corner Store Pty Ltd"]').fill(BIZ);
  await page.locator('input[placeholder="e.g. 2026-27"]').fill('2026-27');

  await page.waitForTimeout(500);
  const businessTypeSelect = page.locator('select').nth(1);
  await businessTypeSelect.selectOption({ label: 'Sole Trader' });
  const selectedValue = await businessTypeSelect.inputValue();
  const selectedLabel = await businessTypeSelect.locator(`option[value="${selectedValue}"]`).textContent();
  expect(selectedLabel?.trim()).toBe('Sole Trader');

  await page.getByLabel('Owner name').fill('Alex Morgan');
  await page.getByRole('button', { name: 'Create Business' }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/tmp/training_business_created.png', fullPage: true });
});
