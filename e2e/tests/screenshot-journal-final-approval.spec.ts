import { test } from '@playwright/test';
import { fixtures } from '../../shared-fixtures/wine-retail.js';

for (const language of ['Hebrew', 'Arabic', 'English']) {
  test(`Screenshot General Journal in ${language}, for final approval`, async ({ page }) => {
    test.setTimeout(30000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' || msg.text().includes('DEBUG')) errors.push(msg.text()); });
    page.on('response', (res) => { if (res.status() === 403) errors.push(`403: ${res.url()}`); });
    await page.goto('/login');
    await page.waitForTimeout(2000);
    await page.locator('input[autocomplete="username"]').fill('admin');
    await page.locator('input[autocomplete="current-password"]').fill('changeme123');
    await page.getByRole('button', { name: /log in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'));
    await page.waitForTimeout(500);
    await page.locator('select').first().selectOption({ label: fixtures.business });
    await page.waitForTimeout(300);
    await page.locator('select').nth(2).selectOption({ label: language });
    await page.waitForTimeout(500);
    const selectedValue = await page.locator('select').nth(2).evaluate((el: HTMLSelectElement) => el.selectedOptions[0]?.textContent);
    console.log(`[${language}] Selected dropdown shows:`, selectedValue);
    await page.locator('button.btn').click();
    await page.waitForURL((url) => url.pathname === '/');
    await page.waitForFunction(
      (lang) => {
        const dir = document.querySelector('.shell')?.getAttribute('dir');
        return lang === 'English' ? dir === 'ltr' : dir === 'rtl';
      },
      language,
      { timeout: 15000 }
    ).catch(() => {});
    const sessionState = await page.evaluate(() => localStorage.getItem('session') ?? sessionStorage.getItem('session') ?? 'not found in storage');
    console.log(`[${language}] Session state:`, sessionState);
    await page.getByRole('link', { name: /General Journal|יומן כללי|اليومية العامة/ }).first().click();
    await page.waitForSelector('legend:has-text("General Journal"), legend:has-text("יומן"), legend:has-text("اليومية")', { timeout: 15000 }).catch(() => {});
    await page.waitForFunction(() => !document.body.innerText.includes('Loading…'), { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);
    console.log(`[${language}] Errors:`, JSON.stringify(errors));
    const shellDir = await page.evaluate(() => document.querySelector('.shell')?.getAttribute('dir'));
    console.log(`[${language}] .shell dir attribute:`, shellDir);
    await page.screenshot({ path: `/tmp/screenshot_journal_${language.toLowerCase()}.png`, fullPage: true });
  });
}
