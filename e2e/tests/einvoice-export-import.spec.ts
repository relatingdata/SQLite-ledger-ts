import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

test('e-invoicing: a real, posted invoice can be exported as a real UBL 2.1 document and imported back as a real, draft Purchase Invoice', async ({ page }) => {
  await login(page);
  await page.locator('select').first().selectOption({ label: 'Wine Retail Company' });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  await page.goto('/invoices');
  await page.waitForSelector('.list-card', { timeout: 8000 });
  await page.waitForTimeout(700);
  await page.locator('.entry').first().click();
  await page.waitForTimeout(700);
  await expect(page.getByRole('button', { name: /Export as e-invoice/i })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Export as e-invoice/i }).click(),
  ]);
  const xmlPath = await download.path();
  const fs = await import('fs');
  let xmlContent = fs.readFileSync(xmlPath!, 'utf-8');
  expect(xmlContent).toContain('urn:oasis:names:specification:ubl:schema:xsd:Invoice-2');
  xmlContent = xmlContent.replace(/<cbc:ID>[^<]+<\/cbc:ID>/, '<cbc:ID>SUPPLIER-INV-8842</cbc:ID>');

  await page.getByRole('button', { name: 'AP (Purchases)' }).click();
  await page.waitForTimeout(500);
  await page.locator('button', { hasText: 'Import e-invoice' }).click();
  await page.waitForTimeout(500);

  await page.setInputFiles('input[type="file"]', { name: 'invoice.xml', mimeType: 'application/xml', buffer: Buffer.from(xmlContent) });
  await page.waitForTimeout(500);
  await page.locator('.card.form-card select').first().selectOption({ index: 1 });
  await page.waitForTimeout(300);

  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.waitForTimeout(1000);

  await expect(page.locator('.import-result')).toContainText('Imported successfully');
  await expect(page.locator('.entry').filter({ hasText: 'SUPPLIER-INV-8842' })).toBeVisible();
});
