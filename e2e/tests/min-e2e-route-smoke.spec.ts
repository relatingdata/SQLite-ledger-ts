import { test, expect } from '@playwright/test';

// A real, minimal smoke layer - per docs/min-e2e-coverage-plan.md,
// see that plan document for the full, real rationale (kept brief
// here deliberately, per direct instruction, to avoid duplicating it).
// Visits every real route at least once, asserting only that it loads
// without a real, unhandled error - not a replacement for this
// project's other, more detailed, scenario-based tests.
const ROUTES = [
  '/', '/account/password', '/arap', '/arap/ap-payment', '/arap/ap-purchase',
  '/arap/ar-receipt', '/arap/ar-sale', '/arap/cash-purchase', '/arap/cash-sale',
  '/arap/quotations', '/arap/rfq', '/cash', '/contacts', '/editor',
  '/exchange-rates', '/gl/fx-adjustment', '/goods-services', '/hr', '/invoices',
  '/items', '/jobs', '/journal', '/journal/1/2026-09-14', '/locations',
  '/logistics/assembly-bom', '/order-entry/generate-invoices',
  '/order-entry/generate-po', '/pos', '/post', '/projects', '/reconciliation',
  '/recurring', '/reports', '/reports/aged', '/reports/balance-sheet',
  '/reports/below-reorder', '/reports/cash-flow-forecast', '/reports/compare',
  '/reports/new-new-pl', '/reports/new-pl', '/reports/new-stock-on-hand',
  '/reports/old-pl', '/reports/profit-and-loss', '/reports/reminders',
  '/reports/sales', '/reports/statement', '/reports/stock-movement',
  '/reports/stock-out-risk', '/reports/trial-balance', '/session', '/setup',
  '/setup/bank-accounts', '/setup/business-setup', '/setup/chart-of-accounts',
  '/setup/currencies', '/setup/new-business', '/setup/periods', '/setup/taxes',
  '/setup/translations', '/setup/tree', '/setup/users', '/setup/vocabulary',
  '/setup/yearend', '/shipping', '/stock', '/stock/listing', '/stock/po',
  '/stock/restock', '/stock/so', '/stock/stock-dispatch', '/stock/stock-receipt',
  '/stock/stock-take', '/stock/transfer', '/stock/write-offs',
  '/vouchers/general-ledger', '/vouchers/payable', '/vouchers/payment',
];

test('Min-e2e route smoke: every real route loads without a real, unhandled error', async ({ page }) => {
  test.setTimeout(300000);
  const realErrors: string[] = [];
  page.on('pageerror', (e) => realErrors.push(e.message));

  await page.goto('/login');
  await page.waitForTimeout(1000);
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('changeme123');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'));
  await page.waitForTimeout(500);
  await page.locator('select').first().selectOption({ label: 'Wine Retail Business' }).catch(() => {});
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click().catch(() => {});
  await page.waitForTimeout(1000);

  const failedRoutes: string[] = [];
  for (const route of ROUTES) {
    const before = realErrors.length;
    try {
      const response = await page.goto(route, { timeout: 15000 });
      await page.waitForTimeout(300);
      const status = response?.status() ?? 0;
      if (status >= 500) failedRoutes.push(`${route} (HTTP ${status})`);
      if (realErrors.length > before) failedRoutes.push(`${route} (JS error: ${realErrors[realErrors.length - 1]})`);
    } catch (e) {
      failedRoutes.push(`${route} (navigation failed: ${e instanceof Error ? e.message : String(e)})`);
    }
  }

  console.log(`Visited ${ROUTES.length} real routes; ${failedRoutes.length} real failures.`);
  expect(failedRoutes, `Real, failing routes:\n${failedRoutes.join('\n')}`).toEqual([]);
});
