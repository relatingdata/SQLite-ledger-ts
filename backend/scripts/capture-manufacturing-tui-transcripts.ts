// The one, real, permanent source of every real terminal transcript
// docs/user-manual-ch4b-manufacturing-tutorial-tui.md embeds — the
// Manufacturing tutorial's own sibling to
// scripts/capture-tui-transcripts.ts (the Retail tutorial's TUI
// chapter, docs/user-manual-ch3b-tutorial-tui.md). Never hand-typed,
// never a throwaway: `make tutorial-section-user-manual-manufacturing-tui`
// (Makefile) runs this on every real build.
//
// Drives the real TUI (tui/src/cli.tsx) live via @microsoft/tui-test
// against the real "Tutorial Window & Door Manufacturing" business
// (built fresh by `make test-e2e-manufacturing-tutorial`, the fast
// --path api run of shared-fixtures/manufacturing-tutorial-steps.csv —
// the same fixture docs/user-manual-ch4-manufacturing-tutorial.md's
// own web screenshots come from) and dumps terminal.text() transcripts
// to docs/manual-images-manufacturing-tutorial-tui/*.txt, each
// embedded verbatim as a fenced code block rather than as an image —
// a terminal's own natural "screenshot" is its real text output, not
// a bitmap of it.
//
// Full, GUI-matching screen parity with the Retail tutorial's own 18-
// screen TUI chapter (capture-tui-transcripts.ts) - per direct
// correction ("lacking a lot of screens and details... should be full
// like the GUI screens"), this no longer skips Purchase/Purchase
// Order/Payment/AR Sale/POS Terminal, or the Item Categories/Other
// Hierarchies Business Structure tabs, on the earlier (wrong) reasoning
// that they're "identical" to the Retail chapter's own. They are the
// same real screens, but every one of them now shows this business's
// own real, different data: three real locations (Raw Materials Store,
// Factory, Finished Goods Store) in every picker, eight real
// Departments/ten real Employees in the Org Chart, five real Item
// Categories, and a real "Process" Other Hierarchy.
//
// Deliberately does not drive any transaction to completion on these
// data-entry screens (Purchase, Cash Purchase, AR Sale, Cash Sale,
// Payment, Purchase Order, New Business) — each is captured exactly as
// it first opens, real labels and real, live picker data included,
// without posting anything that would change the real seeded figures
// the Balance Sheet capture below (and
// docs/user-manual-ch4-manufacturing-tutorial.md's own figures) both
// depend on. New Business is captured only at its first, real step and
// then cancelled (Escape) before any create call.
import { TuiTest } from '@microsoft/tui-test';
import { writeFileSync, mkdirSync } from 'fs';
import { press, typeAndEnter, findItemByText, navigateMenuGenerically } from './text-driver-helpers.js';

const OUT_DIR = '../docs/manual-images-manufacturing-tutorial-tui';
mkdirSync(OUT_DIR, { recursive: true });

const BUSINESS = 'Tutorial Window & Door Manufacturing';

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
    if (text.includes('Menu — ') && !text.includes(`Menu — ${BUSINESS} — `)) return;
    await press(terminal, 'Escape');
  }
}

async function main() {
  const terminal = await TuiTest.ephemeral('tui-capture-manufacturing');
  // Taller than the retail capture's own default (80x30) — this
  // business's real Balance Sheet carries far more real raw-material/
  // assembly inventory accounts (now 25 real items plus eight real
  // Department Payroll/Other Expenses pairs) than the wine retailer's
  // two, which genuinely doesn't fit a 30-row terminal without
  // scrolling the screen's own top border and heading out of the real,
  // captured scrollback. rows/cols belong on run()'s own SpawnOptions,
  // not ephemeral()'s ClientOptions — passing them to ephemeral() (as
  // this script's own first draft, and the retail capture script, both
  // did) is silently a no-op.
  await terminal.run('npx', ['tsx', 'src/cli.tsx'], { cwd: '../tui', rows: 44, cols: 100 });
  await sleep(1000);

  await terminal.getByText('Log in').expect({ timeout: 15_000 });
  await dump(terminal, '01-login');

  await typeAndEnter(terminal, 'admin');
  await typeAndEnter(terminal, 'changeme123');
  await terminal.getByText('Choose a business').expect({ timeout: 10_000 });
  // The real, live getBusinesses() picker list renders a beat after the
  // screen's own header text — a short, real settle delay (same idea as
  // 04-menu-top's own sleep below), so this capture shows the real
  // business list rather than a "Loading…" race.
  await sleep(400);
  await dump(terminal, '02-choose-business');

  await findItemByText(terminal, BUSINESS, 10);
  await press(terminal, 'Enter');
  await terminal.getByText('Choose a ledger').expect({ timeout: 10_000 });
  await dump(terminal, '03-choose-ledger');

  await findItemByText(terminal, 'Actual', 10);
  await press(terminal, 'Enter');
  await terminal.getByText('Menu — ').expect({ timeout: 10_000 });
  await sleep(500);
  await dump(terminal, '04-menu-top');

  // General Journal — the real screen every Stage/Post Journal Line step
  // in the manufacturing fixture (owner's capital, raw-material
  // purchases, BOM reclass entries, weekly wages/overhead across eight
  // real Departments, and every real builder-order sale) posts through.
  await navigateMenuGenerically(terminal, 'General Journal');
  await sleep(400);
  await dump(terminal, '05-general-journal');
  await returnToMenu(terminal);

  // Balance Sheet — the real, final state after every purchase,
  // bulk-length cut, two-level assembly, and every real builder order
  // have posted.
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

  // Business Structure — three real tabs, all three now genuinely
  // populated (per the earlier "lacking... screens" correction, never
  // skipped as merely "identical" to the Retail chapter's own):
  //   Org Chart - this business's own three real locations (Raw
  //   Materials Store, Factory, Finished Goods Store), tagged into two
  //   real Divisions (Production/Warehousing), plus eight real
  //   Departments (the eight workshops) and ten real Employees.
  //   Item Categories - five real categories (Raw Materials, Hardware
  //   & Fittings, Bulk Lengths, Frame Assemblies, Complete Units), every
  //   real item tagged into one.
  //   Other Hierarchies - a real "Process" grouping (Cutting, Glazing,
  //   Framing & Lock Fitting, Packaging), the same real items tagged by
  //   production stage.
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

  // Purchasing screens - real, live picker data: eleven real suppliers
  // (Statewide Timber & Glass Supplies plus ten more, each mapped to
  // the specific raw materials they'd realistically sell) and three
  // real locations.
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

  // Sales screens - two real trade customers (BuildRight Constructions
  // Pty Ltd, Coastal Home Builders Pty Ltd).
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
