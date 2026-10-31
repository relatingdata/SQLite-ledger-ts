// The one, real, permanent source of every real terminal transcript
// docs/user-manual-ch3b-tutorial-tui.md embeds — the TUI edition's own
// equivalent of `scripts/build-user-manual.ts`'s Playwright screenshot
// capture for the web chapter (docs/user-manual-ch3-tutorial.md). Never
// hand-typed, never a throwaway: `make tutorial-section-user-manual-tui`
// (Makefile) runs this on every real build, same as the web chapter's
// own screenshots are captured fresh on every real run of
// test-e2e-tutorial-browser.
//
// Drives the real TUI (tui/src/cli.tsx) live via @microsoft/tui-test
// against the real "Tutorial Wine Retail Business" (built fresh by
// `make test-e2e-tutorial`, the fast --path api run of the same, real,
// shared tutorial fixture the web chapter's own screenshots come from —
// see docs/pm-testing-e2e.md) and dumps terminal.text() transcripts to
// docs/manual-images-tutorial-tui/*.txt, each embedded verbatim as a
// fenced code block in the TUI chapter rather than as an image — a
// terminal's own natural "screenshot" is its real text output, not a
// bitmap of it.
//
// Deliberately does not drive any transaction to completion on these
// data-entry screens (Purchase, Cash Purchase, AR Sale, Cash Sale,
// Payment, Purchase Order) — each one is captured exactly as it first
// opens, real labels and real, live picker data (locations, customers)
// included, without posting anything that would change the real
// seeded figures docs/user-manual-ch3-tutorial.md and the backend's own
// expected-results tests already depend on. New Business is likewise
// captured only at its first, real step and then cancelled (Escape)
// before any create call — this script's job is to show what each real,
// built screen looks like, not to re-run the whole tutorial narrative a
// second time through a still-partial `--path text` driver (see "Known
// gap: TUI screen granularity doesn't match screens.csv",
// docs/pm-testing-e2e.md, for exactly how far that driver's own,
// separate, generic step-runner.ts path currently reaches).
import { TuiTest } from '@microsoft/tui-test';
import { writeFileSync, mkdirSync } from 'fs';
import { press, typeAndEnter, findItemByText, navigateMenuGenerically } from './text-driver-helpers.js';

const OUT_DIR = '../docs/manual-images-tutorial-tui';
mkdirSync(OUT_DIR, { recursive: true });

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function dump(terminal: TuiTest, name: string) {
  const text = await terminal.text();
  writeFileSync(`${OUT_DIR}/${name}.txt`, text.replace(/\s+$/gm, '').replace(/\n{3,}/g, '\n\n'));
  console.log(`captured ${name}`);
}

async function returnToMenu(terminal: TuiTest) {
  for (let i = 0; i < 6; i++) {
    const text = await terminal.text();
    if (text.includes('Menu — ') && !text.includes('Menu — Tutorial Wine Retail Business — ')) return;
    await press(terminal, 'Escape');
  }
}

async function main() {
  const terminal = await TuiTest.ephemeral('tui-capture', { rows: 32, cols: 100 });
  await terminal.run('npx', ['tsx', 'src/cli.tsx'], { cwd: '../tui' });
  await sleep(1000);

  await terminal.getByText('Log in').expect({ timeout: 15_000 });
  await dump(terminal, '01-login');

  await typeAndEnter(terminal, 'admin');
  await typeAndEnter(terminal, 'changeme123');
  await terminal.getByText('Choose a business').expect({ timeout: 10_000 });
  await dump(terminal, '02-choose-business');

  await findItemByText(terminal, 'Tutorial Wine Retail Business', 10);
  await press(terminal, 'Enter');
  await terminal.getByText('Choose a ledger').expect({ timeout: 10_000 });
  await dump(terminal, '03-choose-ledger');

  await findItemByText(terminal, 'Actual', 10);
  await press(terminal, 'Enter');
  await terminal.getByText('Menu — ').expect({ timeout: 10_000 });
  await sleep(500);
  await dump(terminal, '04-menu-top');

  // General Journal
  await navigateMenuGenerically(terminal, 'General Journal');
  await sleep(400);
  await dump(terminal, '05-general-journal');
  await returnToMenu(terminal);

  // Balance Sheet
  await navigateMenuGenerically(terminal, 'Balance Sheet');
  await sleep(600);
  await dump(terminal, '06-balance-sheet');
  await returnToMenu(terminal);

  // New Business wizard (initial form only — Escape before any create)
  await navigateMenuGenerically(terminal, 'New Business');
  await sleep(400);
  await dump(terminal, '07-new-business-wizard');
  await press(terminal, 'Escape');
  await returnToMenu(terminal);

  // Business Structure — three tabs: Org Chart, Item Categories, Other Hierarchies
  await navigateMenuGenerically(terminal, 'Business Structure');
  await sleep(500);
  await dump(terminal, '08-business-structure-org-chart');
  await press(terminal, 'Right');
  await sleep(400);
  await dump(terminal, '09-business-structure-item-categories');
  await press(terminal, 'Right');
  await sleep(400);
  await dump(terminal, '10-business-structure-other-hierarchies');
  await returnToMenu(terminal);

  // Purchasing screens
  await navigateMenuGenerically(terminal, 'Purchase');
  await sleep(400);
  await dump(terminal, '11-purchase');
  await returnToMenu(terminal);

  await navigateMenuGenerically(terminal, 'Cash Purchase');
  await sleep(400);
  await dump(terminal, '12-cash-purchase');
  await returnToMenu(terminal);

  await navigateMenuGenerically(terminal, 'Purchase Order');
  await sleep(400);
  await dump(terminal, '13-purchase-order');
  await returnToMenu(terminal);

  await navigateMenuGenerically(terminal, 'Payment');
  await sleep(400);
  await dump(terminal, '14-payment');
  await returnToMenu(terminal);

  // Sales screens
  await navigateMenuGenerically(terminal, 'Sale');
  await sleep(400);
  await dump(terminal, '15-ar-sale');
  await returnToMenu(terminal);

  await navigateMenuGenerically(terminal, 'Cash Sale');
  await sleep(400);
  await dump(terminal, '16-cash-sale');
  await returnToMenu(terminal);

  await navigateMenuGenerically(terminal, 'Customers');
  await sleep(500);
  await dump(terminal, '17-customers');
  await returnToMenu(terminal);

  // POS Terminal
  await navigateMenuGenerically(terminal, 'POS Terminal');
  await sleep(500);
  await dump(terminal, '18-pos-terminal');

  await terminal.close();
  console.log('done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
