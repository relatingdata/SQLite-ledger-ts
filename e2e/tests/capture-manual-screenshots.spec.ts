import { test } from '@playwright/test';
import fixtures from '../../shared-fixtures/wine-retail.json' with { type: 'json' };
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LANGUAGE = process.env.MANUAL_LANGUAGE ?? 'English';
const SUFFIX = LANGUAGE === 'English' ? '' : `-${LANGUAGE.toLowerCase()}`;
const OUT_DIR = path.join(__dirname, '..', '..', 'docs', `manual-images${SUFFIX}`);

/** MANUAL_SCREEN, if set, captures only that one named screen and
 * exits - enabling a real, individual Makefile target per screenshot,
 * each depending only on its own real source file(s). If unset,
 * every screen below is captured in one continuous run, matching the
 * script's original, real behavior. */
const ONLY = process.env.MANUAL_SCREEN;

async function loginAndChooseBusiness(page: any) {
  await page.goto('/login');
  await page.waitForTimeout(3000);
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('changeme123');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL((url: URL) => !url.pathname.includes('/login'));
  await page.waitForTimeout(500);
  if (LANGUAGE !== 'English') {
    const languageSelect = page.locator('select').last();
    await languageSelect.selectOption({ label: LANGUAGE });
    await page.waitForTimeout(500);
  }
  await page.locator('select').first().selectOption({ label: fixtures.business });
  await page.waitForTimeout(500);
}

async function continueToApp(page: any) {
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url: URL) => url.pathname === '/');
  await page.waitForTimeout(1000);
}

const SCREENS: Record<string, (page: any) => Promise<void>> = {
  m_login: async (page) => {
    await page.goto('/login');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(OUT_DIR, 'm_login.png'), fullPage: true });
  },
  m_choose_business: async (page) => {
    await loginAndChooseBusiness(page);
    await page.screenshot({ path: path.join(OUT_DIR, 'm_choose_business.png'), fullPage: true });
  },
  m_home: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.screenshot({ path: path.join(OUT_DIR, 'm_home.png'), fullPage: true });
  },
  m_configuration_landing: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/setup');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, 'm_configuration_landing.png'), fullPage: true });
  },
  m_new_business: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/setup/new-business');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, 'm_new_business.png'), fullPage: true });
  },
  m_business_setup: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/setup/business-setup');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT_DIR, 'm_business_setup.png'), fullPage: true });
  },
  m_locations: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/locations');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, 'm_locations.png'), fullPage: true });
  },
  m_items_new_category_full: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/items');
    await page.waitForTimeout(800);
    const categorySelect = page.locator('select').last();
    await categorySelect.selectOption({ index: 1 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT_DIR, 'm_items_new_category_full.png'), fullPage: true });
  },
  m_balance_sheet: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/reports/balance-sheet');
    await page.waitForTimeout(1500);
    await page.getByText(/clear/i).click();
    await page.waitForTimeout(20000);
    await page.screenshot({ path: path.join(OUT_DIR, 'm_balance_sheet.png'), fullPage: true });
  },
  m_contact_persons: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/contacts?focus=vendors');
    await page.waitForTimeout(1200);
    await page.getByText('Boutique Wine Importers Pty Ltd').click();
    await page.waitForTimeout(800);
    const contactsGroup = page.getByRole('group', { name: 'Contacts' });
    await contactsGroup.click();
    await page.keyboard.press('Insert');
    await page.waitForTimeout(400);
    await contactsGroup.locator('select').selectOption({ label: 'Credit Manager' });
    await contactsGroup.locator('input[placeholder="e.g. Jordan Reyes"]').fill('Priya Chandrasekaran');
    await contactsGroup.locator('input[placeholder="Phone"]').fill('0412 887 213');
    await contactsGroup.locator('input[placeholder="Email (optional)"]').fill('priya@boutiquewine.example');
    await contactsGroup.getByRole('button', { name: 'Save Contact' }).click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, 'm_contact_persons.png'), fullPage: true });
  },
  purchase_order: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/stock/po');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'purchase_order.png'), fullPage: true });
  },
  ar_sale: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/arap/ar-sale');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'ar_sale.png'), fullPage: true });
  },
  ar_receipt: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/arap/ar-receipt');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'ar_receipt.png'), fullPage: true });
  },
  ap_purchase: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/arap/ap-purchase');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'ap_purchase.png'), fullPage: true });
  },
  ap_payment: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/arap/ap-payment');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'ap_payment.png'), fullPage: true });
  },
  cash_sale: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/arap/cash-sale');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'cash_sale.png'), fullPage: true });
  },
  cash_purchase: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/arap/cash-purchase');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'cash_purchase.png'), fullPage: true });
  },
  pos_terminal: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/pos');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'pos_terminal.png'), fullPage: true });
  },
  general_journal: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/post');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'general_journal.png'), fullPage: true });
  },
  sales_order: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/stock/so');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'sales_order.png'), fullPage: true });
  },
  stock_receipt: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/stock/stock-receipt');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'stock_receipt.png'), fullPage: true });
  },
  stock_dispatch: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/stock/stock-dispatch');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'stock_dispatch.png'), fullPage: true });
  },
  stock_transfer: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/stock/transfer');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'stock_transfer.png'), fullPage: true });
  },
  stock_take: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/stock/stock-take');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'stock_take.png'), fullPage: true });
  },
  write_offs: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/stock/write-offs');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'write_offs.png'), fullPage: true });
  },
  hr_wages: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/hr');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'hr_wages.png'), fullPage: true });
  },
  projects: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/projects');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'projects.png'), fullPage: true });
  },
  account_password: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/account/password');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT_DIR, 'account_password.png'), fullPage: true });
  },
  customer_terminal: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/customer-terminal');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT_DIR, 'customer_terminal.png'), fullPage: true });
  },
  editor: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/editor');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'editor.png'), fullPage: true });
  },
  invoices: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/invoices');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'invoices.png'), fullPage: true });
  },
  journal: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/journal');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'journal.png'), fullPage: true });
  },
  reports_aged: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/reports/aged');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'reports_aged.png'), fullPage: true });
  },
  reports_below_reorder: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/reports/below-reorder');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'reports_below_reorder.png'), fullPage: true });
  },
  reports_cash_flow_forecast: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/reports/cash-flow-forecast');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'reports_cash_flow_forecast.png'), fullPage: true });
  },
  reports_compare: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/reports/compare');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'reports_compare.png'), fullPage: true });
  },
  reports_new_new_pl: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/reports/new-new-pl');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'reports_new_new_pl.png'), fullPage: true });
  },
  reports_new_pl: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/reports/new-pl');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'reports_new_pl.png'), fullPage: true });
  },
  reports_new_stock_on_hand: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/reports/new-stock-on-hand');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'reports_new_stock_on_hand.png'), fullPage: true });
  },
  reports_old_pl: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/reports/old-pl');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'reports_old_pl.png'), fullPage: true });
  },
  reports_profit_and_loss: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/reports/profit-and-loss');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'reports_profit_and_loss.png'), fullPage: true });
  },
  reports_reminders: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/reports/reminders');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'reports_reminders.png'), fullPage: true });
  },
  reports_sales: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/reports/sales');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'reports_sales.png'), fullPage: true });
  },
  reports_statement: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/reports/statement');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'reports_statement.png'), fullPage: true });
  },
  reports_stock_movement: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/reports/stock-movement');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'reports_stock_movement.png'), fullPage: true });
  },
  reports_trial_balance: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/reports/trial-balance');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'reports_trial_balance.png'), fullPage: true });
  },
  setup_bank_accounts: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/setup/bank-accounts');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'setup_bank_accounts.png'), fullPage: true });
  },
  setup_chart_of_accounts: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/setup/chart-of-accounts');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'setup_chart_of_accounts.png'), fullPage: true });
  },
  setup_periods: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/setup/periods');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'setup_periods.png'), fullPage: true });
  },
  setup_translations: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/setup/translations');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'setup_translations.png'), fullPage: true });
  },
  setup_users: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/setup/users');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'setup_users.png'), fullPage: true });
  },
  setup_vocabulary: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/setup/vocabulary');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'setup_vocabulary.png'), fullPage: true });
  },
  setup_yearend: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/setup/yearend');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'setup_yearend.png'), fullPage: true });
  },
  stock_listing: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/stock/listing');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'stock_listing.png'), fullPage: true });
  },
  stock_restock: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/stock/restock');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'stock_restock.png'), fullPage: true });
  },
  m_multi_location_schedule: async (page) => {
    await loginAndChooseBusiness(page);
    await continueToApp(page);
    await page.goto('/setup/business-setup');
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: 'Nadia Petrovska' }).click();
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: /add a location/i }).click();
    await page.waitForTimeout(400);
    await page.locator('#new-additional-location').selectOption({ label: 'Harbourside Bottle Shop' });
    const additionalCheckboxes = page.locator('.additional-location-form input[type="checkbox"]');
    await additionalCheckboxes.nth(1).check();
    await additionalCheckboxes.nth(3).check();
    await page.waitForTimeout(300);
    await page.locator('.additional-location-form').getByRole('button', { name: /save/i }).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT_DIR, 'm_multi_location_schedule.png'), fullPage: true });
  },
};

test('Capture manual screenshots', async ({ page }) => {
  test.setTimeout(300000);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  if (ONLY) {
    const capture = SCREENS[ONLY];
    if (!capture) {
      throw new Error(`Unknown MANUAL_SCREEN "${ONLY}". Known: ${Object.keys(SCREENS).join(', ')}`);
    }
    await capture(page);
    return;
  }

  for (const name of Object.keys(SCREENS)) {
    await SCREENS[name](page);
  }
});
