// A real, live, end-to-end smoke test for the TUI, driven through
// @microsoft/tui-test — a genuine terminal-emulator engine (not a
// mock, not a hand-rolled ANSI-stripping pty wrapper), used the same
// way Playwright drives the browser frontend's own e2e suite (e2e/).
// Replaces the throwaway Python pty scripts used to verify this
// screen-by-screen during development.
//
// Requires a real, running backend on :3001 with the real tutorial
// fixture loaded (`make reset-db && cd backend && npx tsx
// scripts/step-runner.ts ../shared-fixtures/tutorial-steps.csv --path
// api --non-interactive`, or just `make test-tui`, which does both) —
// this test logs in as the real seeded admin user and drives the real
// "Tutorial Wine Retail Business" exactly the way a person would.
//
// Menu item order below (General Journal(0)/Journal Entries(1)/
// Reconciliation(2)/FX Adjustment(3)/Trial Balance(4)/Balance
// Sheet(5) within General Ledger; Entity Tree(0)/Structured
// Editor(1)/Chart of Accounts(2)/New Business(3)/Business Setup(4)/
// Business Structure(5) within Configuration; Configuration itself as
// the 12th and last top-level section) is read directly from
// backend/src/db-seed.ts's own, real, hand-authored seed order — not
// guessed. Each screen in `Menu.tsx` unmounts and remounts fresh on
// every visit (App.tsx's screen union), so a freshly-opened list
// always starts back at its own index 0; that's what makes a fixed
// number of Down presses from a known starting point reliable here,
// rather than hunting for a highlight marker whose exact glyph
// (figures.pointer vs a plain ">") depends on the terminal's own
// unicode-support detection.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TuiTest } from '@microsoft/tui-test';
import { withTerminal } from '@microsoft/tui-test/test';
import { test } from './test-runtime.ts';

const TUI_DIR = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// `terminal.submit()`/`.type()` write the whole string as one chunk,
// which trips Ink's own paste-detection heuristic (any multi-character
// chunk arriving in a single `data` event is treated as a paste, not
// discrete keystrokes — the same, real behavior the Python pty driver
// used during development had to work around the same way). A single
// `keyboard.press(...chars)` call for the whole string turned out to
// have the same problem — confirmed live, it occasionally drops or
// duplicates a character (e.g. "admin" arriving as "adminm") — because
// nothing paces the keys it sends, and several can still land in one
// read on the pty side. A real, explicit delay between each discrete
// key press, confirmed live to fix it, is what actually avoids this —
// the same fix the Python pty driver needed for the same, real reason.
async function typeAndEnter(terminal: TuiTest, text: string): Promise<void> {
  for (const ch of text) {
    await terminal.keyboard.press(ch);
    await sleep(30);
  }
  await sleep(30);
  await press(terminal, 'Enter');
}

// Same reasoning as typeAndEnter above — a repeated arrow key is just
// as capable of landing two presses in the same native-side read as a
// run of character keys, silently selecting the wrong list item.
async function pressRepeated(terminal: TuiTest, key: string, times: number): Promise<void> {
  for (let i = 0; i < times; i++) {
    await terminal.keyboard.press(key);
    await sleep(30);
  }
}

// A single key right after a screen transition turned out to be just
// as flaky, confirmed live across repeated runs (a Down+Enter pair
// fired the instant a list's text first appears can still occasionally
// race the SelectInput component actually attaching its own input
// listener) — so every key press in this file goes through this one,
// settled wrapper rather than the raw client call.
async function press(terminal: TuiTest, key: string): Promise<void> {
  await terminal.keyboard.press(key);
  await sleep(100);
}

// Moves the highlight ('› ') down, one settled press at a time, until it
// lands on a line containing `labelSubstring` — robust against a list
// whose exact contents/order this test doesn't fully control (a real
// business's own, real, pre-existing data alongside whatever this run
// just created), without parsing the panel's own box-drawing border
// characters to compute an index by hand.
async function selectItemByText(terminal: TuiTest, labelSubstring: string, maxSteps = 30): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    const lines = (await terminal.text()).split('\n');
    if (lines.some((l) => l.includes('›') && l.includes(labelSubstring))) return;
    await press(terminal, 'Down');
  }
  throw new Error(`selectItemByText: never found a highlighted line containing "${labelSubstring}" within ${maxSteps} Down presses`);
}

test('TUI smoke: login through every implemented screen', { timeout: 60_000 }, async () => {
  const home = mkdtempSync(path.join(tmpdir(), 'sql-ledger-ts-tui-test-'));
  try {
    await withTerminal(
      {
        program: ['npx', 'tsx', 'src/cli.tsx'],
        cwd: TUI_DIR,
        env: { HOME: home },
        cols: 100,
        rows: 40,
        timeouts: { text: 10_000 },
      },
      async (terminal) => {
        // --- Login ---------------------------------------------------
        await terminal.getByText('Log in').expect();
        await typeAndEnter(terminal, 'admin');
        await typeAndEnter(terminal, 'changeme123');

        // --- Business / ledger selection -------------------------------
        await terminal.getByText('Choose a business').expect();
        await press(terminal, 'Down'); // "Tutorial Wine Retail Business"
        await press(terminal, 'Enter');
        await terminal.getByText('Choose a ledger').expect();
        await press(terminal, 'Enter'); // "Actual"
        await terminal.getByText('Menu — ').expect();

        // --- Menu: General Ledger -> General Journal --------------------
        await terminal.getByText('General Ledger').expect(); // top-level, index 0, already highlighted
        await press(terminal, 'Enter');
        await terminal.getByText('General Journal').expect(); // section links, index 0
        await press(terminal, 'Enter');
        await terminal.getByText('General Journal — ').expect();

        const reference = `TUI-TEST-${Date.now()}`;
        await typeAndEnter(terminal, reference);
        await terminal.getByText('No lines staged').expect();

        await press(terminal, 'i'); // Insert — add a line
        await terminal.getByText('New line').expect();
        await typeAndEnter(terminal, 'Cash and Bank');
        await typeAndEnter(terminal, '10.00');
        await press(terminal, 'Enter'); // skip credit
        await terminal.getByText(reference).expect();

        await press(terminal, 'i');
        await terminal.getByText('New line').expect();
        await typeAndEnter(terminal, "Owner's Equity");
        await press(terminal, 'Enter'); // skip debit
        await typeAndEnter(terminal, '10.00');
        await terminal.getByText('Total').expect();
        await press(terminal, 'p'); // Post (balanced)
        await terminal.getByText('Posted — ').expect();
        await press(terminal, 'Escape'); // back to menu

        // --- Menu: General Ledger -> Balance Sheet -----------------------
        await terminal.getByText('Menu — ').expect();
        await press(terminal, 'Enter'); // fresh mount — back into General Ledger section at index 0
        await terminal.getByText('Balance Sheet').expect();
        await pressRepeated(terminal, 'Down', 5); // General Journal -> Balance Sheet, index 5
        await press(terminal, 'Enter');
        await terminal.getByText('Balance Sheet — ').expect();
        await terminal.getByText('alanced').expect(); // matches both "Balanced" and "NOT balanced"
        await press(terminal, 'Escape');

        // --- Menu: Configuration -> New Business --------------------------
        await terminal.getByText('Menu — ').expect();
        await pressRepeated(terminal, 'Down', 11); // the 12th, last top-level section
        await press(terminal, 'Enter');
        await terminal.getByText('New Business').expect();
        await pressRepeated(terminal, 'Down', 3); // Entity Tree -> New Business, index 3
        await press(terminal, 'Enter');
        await terminal.getByText('New Business — name').expect();

        const businessName = `TUI Smoke Co ${Date.now()}`;
        await typeAndEnter(terminal, businessName);
        await terminal.getByText('financial year label').expect();
        await press(terminal, 'Enter'); // accept default label
        await terminal.getByText('financial year start date').expect();
        await press(terminal, 'Enter'); // accept default start
        await terminal.getByText('reporting frequency').expect();
        await press(terminal, 'Enter'); // Annual
        await terminal.getByText('Chart of Accounts prototype').expect();
        await press(terminal, 'Enter'); // English CoA
        await terminal.getByText('legal structure').expect();
        await press(terminal, 'Enter'); // Sole Trader — no partners sub-step
        await terminal.getByText('home currency').expect();
        await press(terminal, 'Enter'); // accept default AUD
        await terminal.getByText('additional currencies').expect();
        await press(terminal, 'Enter'); // none
        await terminal.getByText('review').expect();
        await press(terminal, 'Enter'); // "Create this business"
        await terminal.getByText(`${businessName} created`).expect({ timeout: 15_000 });
        await terminal.getByText('Username:').expect();
        await terminal.getByText('Password:').expect();
        await press(terminal, 'Enter'); // continue to the bank wizard
        await terminal.getByText('nominate a bank account').expect();
        await press(terminal, 'Escape'); // skip the rest — the business itself already exists
        await terminal.getByText('Menu — ').expect();

        // --- Menu: Configuration -> Business Structure (Org Chart) ---------
        await pressRepeated(terminal, 'Down', 11);
        await press(terminal, 'Enter');
        await terminal.getByText('Business Structure').expect();
        await pressRepeated(terminal, 'Down', 5); // Entity Tree -> Business Structure, index 5
        await press(terminal, 'Enter');
        await terminal.getByText('Org Chart — ').expect();

        const departmentName = `TUI Smoke Dept ${Date.now()}`;
        await press(terminal, 'i'); // Insert — opens the add-menu (Location / Division / Department)
        await terminal.getByText('— add').expect();
        await pressRepeated(terminal, 'Down', 2); // Location -> Division -> Department
        await press(terminal, 'Enter');
        await terminal.getByText('new department').expect();
        await typeAndEnter(terminal, departmentName);
        await terminal.getByText(`${departmentName} (0)`).expect({ timeout: 10_000 });

        let text = await terminal.text();
        assert.match(text, /Unassigned/, 'the real, server-computed Unassigned bucket should always be present');

        // --- Add a Division -------------------------------------------
        const divisionName = `TUI Smoke Div ${Date.now()}`;
        await press(terminal, 'i');
        await terminal.getByText('— add').expect();
        await press(terminal, 'Down'); // Location -> Division
        await press(terminal, 'Enter');
        await terminal.getByText('new division').expect();
        await typeAndEnter(terminal, divisionName);
        await terminal.getByText(`${divisionName} (0)`).expect({ timeout: 10_000 });

        // --- Add a Location, then move it into that Division -----------
        const locationName = `TUI Smoke Loc ${Date.now()}`;
        await press(terminal, 'i');
        await terminal.getByText('— add').expect();
        await press(terminal, 'Enter'); // Location is the first item
        await terminal.getByText('new location').expect();
        await typeAndEnter(terminal, locationName); // name
        await terminal.getByText('— city').expect();
        await typeAndEnter(terminal, 'Adelaide'); // city
        await terminal.getByText('— type').expect();
        await press(terminal, 'Enter'); // accept the default type
        await terminal.getByText('bottle capacity').expect();
        await press(terminal, 'Enter'); // skip — optional
        await terminal.getByText('carton capacity').expect();
        await press(terminal, 'Enter'); // skip — creates the location
        await terminal.getByText('Unassigned (no division)').expect({ timeout: 10_000 });

        // The new Location starts out in "Unassigned (no division)" — always
        // the last Division bucket, right before the Departments section.
        // Every bucket line (Division or Department) ends in "(<count>)",
        // in the same top-to-bottom order the real, flat bucket-selection
        // array uses, so this line's position IS its real bucket index.
        text = await terminal.text();
        // The panel's box-drawing border leaves a trailing "│" and padding
        // after the real "(<count>)" text, so this matches by substring
        // rather than anchoring to end-of-line.
        const bucketLines = text.split('\n').filter((l) => /\(\d+\)/.test(l));
        const unassignedDivIndex = bucketLines.findIndex((l) => l.includes('Unassigned (no division)'));
        assert.notEqual(unassignedDivIndex, -1, 'Unassigned (no division) bucket should be present');
        await pressRepeated(terminal, 'Down', unassignedDivIndex);
        await press(terminal, 'Enter');
        await terminal.getByText(locationName).expect();
        await press(terminal, 'Enter'); // open the division-move picker for the (only, highlighted) location
        await terminal.getByText(divisionName).expect();
        // The move-picker's own item order is "Unassigned (no division)"
        // first, then every real division (sorted) — same real list this
        // business's own Division grouping returns, which may already hold
        // other, pre-existing divisions (e.g. a real tutorial business's
        // own "Adelaide Metro"). Compute the real distance by text position
        // rather than assuming our new division is the very next item.
        text = await terminal.text();
        {
          const pickerLines = text.split('\n').map((l) => l.trim());
          const unassignedLine = pickerLines.findIndex((l) => l.includes('Unassigned (no division)'));
          const targetLine = pickerLines.findIndex((l, i) => i > unassignedLine && l.includes(divisionName));
          assert.notEqual(targetLine, -1, 'the new division should appear in the move-picker list');
          await pressRepeated(terminal, 'Down', targetLine - unassignedLine);
        }
        await press(terminal, 'Enter');
        // Lands back on this same "Unassigned (no division)" bucket's own
        // locations list, now missing the one just moved out.
        await terminal.getByText('No locations in this bucket.').expect({ timeout: 10_000 });
        await press(terminal, 'Escape');
        await terminal.getByText('Org Chart — ').expect(); // back on the Org Chart buckets screen
        text = await terminal.text();
        assert.match(text, new RegExp(`${divisionName} \\(1\\)`), 'the location should now be counted under its new division');

        // --- ←/→ step over to Item Categories, add a top-level one, drill
        // into it, add a child, then back up a level --------------------
        await press(terminal, 'Right');
        await terminal.getByText('Item Categories').expect({ timeout: 10_000 });

        const categoryName = `TUI Smoke Cat ${Date.now()}`;
        await press(terminal, 'i');
        await terminal.getByText('new category').expect();
        await typeAndEnter(terminal, categoryName);
        await terminal.getByText(categoryName).expect({ timeout: 10_000 });

        await selectItemByText(terminal, categoryName);
        await press(terminal, 'Enter'); // drill into the new, empty category
        await terminal.getByText(`— ${categoryName}`).expect({ timeout: 10_000 });
        await terminal.getByText('No categories here yet').expect();

        const childCategoryName = `TUI Smoke SubCat ${Date.now()}`;
        await press(terminal, 'i');
        await terminal.getByText('new category').expect();
        await typeAndEnter(terminal, childCategoryName);
        await terminal.getByText(childCategoryName).expect({ timeout: 10_000 });

        await press(terminal, 'Escape'); // back up a level, not out to the menu
        await terminal.getByText('Item Categories — ').expect();
        text = await terminal.text();
        assert.match(text, new RegExp(`${categoryName} \\(1\\)`), 'the new category should now show its one child');

        // --- ←/→ step over to Other Hierarchies, add a grouping + value --
        await press(terminal, 'Right');
        await terminal.getByText('Other Hierarchies').expect({ timeout: 10_000 });

        const groupingName = `TUI Smoke Grouping ${Date.now()}`;
        await press(terminal, 'i');
        await terminal.getByText('Enter creates it').expect();
        await typeAndEnter(terminal, groupingName);
        await terminal.getByText(`${groupingName} (0)`).expect({ timeout: 10_000 });

        await selectItemByText(terminal, groupingName);
        await press(terminal, 'Enter'); // open the new, empty grouping
        await terminal.getByText(`Other Hierarchies — `).expect();
        await terminal.getByText('No values yet').expect();

        const hierarchyValueName = `TUI Smoke Value ${Date.now()}`;
        await press(terminal, 'i');
        await terminal.getByText('Enter creates it').expect();
        await typeAndEnter(terminal, hierarchyValueName);
        await terminal.getByText(hierarchyValueName).expect({ timeout: 10_000 });

        // --- ←/← back to Org Chart, then Escape all the way out ---------
        await press(terminal, 'Left');
        await terminal.getByText('Item Categories').expect({ timeout: 10_000 });
        await press(terminal, 'Left');
        await terminal.getByText('Org Chart — ').expect({ timeout: 10_000 });
        await press(terminal, 'Escape');
        await terminal.getByText('Menu — ').expect();

        // --- Menu: Accounts Payable -> Purchase ---------------------------
        // Section order from backend/src/db-seed.ts: General Ledger(0),
        // test(1), Accounts Receivable(2), Accounts Payable(3). Within
        // Accounts Payable: Purchase(0), Cash Purchase(1), Payment(2),
        // Purchase Invoices(3), Purchase Order(4). The real tutorial
        // fixture has exactly one real provider ('Cash') and these real
        // items: 'Amber Ale 330ml', 'Highland Single Malt 700ml', 'Ice'.
        await pressRepeated(terminal, 'Down', 3);
        await press(terminal, 'Enter');
        await terminal.getByText('Purchase').expect();
        await press(terminal, 'Enter'); // Purchase, index 0
        await terminal.getByText('AP Purchase — ').expect();

        const purchaseRef = `TUI-PUR-${Date.now()}`;
        await typeAndEnter(terminal, purchaseRef);
        await terminal.getByText('Provider').expect();
        await typeAndEnter(terminal, 'Cash');
        await terminal.getByText('Account (what this was for)').expect();
        await typeAndEnter(terminal, 'Inventory');
        await terminal.getByText('Tax %').expect();
        await press(terminal, 'Enter'); // skip — no tax
        await terminal.getByText('Where item lines').expect();
        // This picker's own first item is "Not yet known" (NO_LOCATION) —
        // unlike Cash Purchase's, which has no such option — so Down once
        // is needed to land on the first real location rather than no
        // location at all (which would later block the save, since the
        // one line below names a real catalog item and so must be
        // received into stock somewhere).
        await press(terminal, 'Down');
        await press(terminal, 'Enter'); // first real location
        await terminal.getByText('Optional · Enter continues').expect();
        await press(terminal, 'Enter'); // skip description
        await terminal.getByText('No lines yet').expect();

        await press(terminal, 'i');
        await terminal.getByText('New line').expect();
        await typeAndEnter(terminal, 'Amber Ale 330ml');
        await typeAndEnter(terminal, '5');
        await typeAndEnter(terminal, '10.00');
        await terminal.getByText('Total owed').expect();
        let text2 = await terminal.text();
        assert.match(text2, /5\s+\$10\.00/, 'quantity and price should render exactly as typed, not concatenated with a stale default');
        await press(terminal, 's'); // save (no payment-method prompt — on-account)
        await terminal.getByText('recorded — ').expect({ timeout: 10_000 });
        await press(terminal, 'Escape');
        await terminal.getByText('Menu — ').expect();

        // --- Menu: Accounts Payable -> Cash Purchase -----------------------
        await pressRepeated(terminal, 'Down', 3);
        await press(terminal, 'Enter');
        await terminal.getByText('Purchase').expect();
        await press(terminal, 'Down'); // Cash Purchase, index 1
        await press(terminal, 'Enter');
        await terminal.getByText('Cash Purchase — ').expect();
        await terminal.getByText('Receive at location').expect();
        await press(terminal, 'Enter'); // first real location
        await terminal.getByText('No lines yet').expect();

        await press(terminal, 'i');
        await terminal.getByText('New line').expect();
        await typeAndEnter(terminal, 'Amber Ale 330ml');
        await typeAndEnter(terminal, '3');
        await typeAndEnter(terminal, '10.00');
        await typeAndEnter(terminal, '1.00');
        await terminal.getByText('Total to pay').expect();
        text2 = await terminal.text();
        assert.match(text2, /3\s+\$10\.00\s+\$1\.00/, 'quantity, price, and tax should render exactly as typed');
        await press(terminal, 's');
        await terminal.getByText('payment method').expect();
        await press(terminal, 'Enter'); // Cash
        await terminal.getByText('completed — ').expect({ timeout: 10_000 });
        await press(terminal, 'Escape');
        await terminal.getByText('Menu — ').expect();

        // --- Menu: Accounts Payable -> Payment ------------------------------
        await pressRepeated(terminal, 'Down', 3);
        await press(terminal, 'Enter');
        await terminal.getByText('Purchase').expect();
        await pressRepeated(terminal, 'Down', 2); // Payment, index 2
        await press(terminal, 'Enter');
        await terminal.getByText('AP Payment — ').expect();

        const paymentRef = `TUI-PMT-${Date.now()}`;
        await typeAndEnter(terminal, paymentRef);
        await terminal.getByText('Provider').expect();
        await typeAndEnter(terminal, 'Cash');
        await terminal.getByText('Amount').expect();
        await typeAndEnter(terminal, '25.00');
        await terminal.getByText('Optional · Enter saves').expect();
        await press(terminal, 'Enter'); // skip description — saves and posts
        await terminal.getByText('recorded.').expect({ timeout: 10_000 });
        await press(terminal, 'Escape');
        await terminal.getByText('Menu — ').expect();

        // --- Menu: Accounts Payable -> Purchase Order -----------------------
        await pressRepeated(terminal, 'Down', 3);
        await press(terminal, 'Enter');
        await terminal.getByText('Purchase').expect();
        await pressRepeated(terminal, 'Down', 4); // Purchase Order, index 4
        await press(terminal, 'Enter');
        await terminal.getByText('Purchase Order — ').expect();

        const poRef = `TUI-PO-${Date.now()}`;
        await typeAndEnter(terminal, poRef);
        await terminal.getByText('Item').expect();
        await typeAndEnter(terminal, 'Amber Ale 330ml');
        await terminal.getByText('Provider').expect();
        await typeAndEnter(terminal, 'Cash');
        await terminal.getByText('Quantity').expect();
        await typeAndEnter(terminal, '2');
        await terminal.getByText('Price per unit').expect();
        await typeAndEnter(terminal, '9.50');
        await terminal.getByText('Delivery location').expect();
        await press(terminal, 'Down'); // skip "Not yet known" -> first real location
        await press(terminal, 'Enter');
        await terminal.getByText('Optional · Enter continues').expect();
        await press(terminal, 'Enter'); // skip description -> review
        await terminal.getByText('review').expect();
        text2 = await terminal.text();
        assert.match(text2, /Quantity: 2/);
        assert.match(text2, /Price per unit: \$9\.50/);
        await press(terminal, 's');
        await terminal.getByText('placed with').expect({ timeout: 10_000 });
        await press(terminal, 'Escape');
        await terminal.getByText('Menu — ').expect();

        // --- Menu: Accounts Receivable -> AR Sale ---------------------------
        // Section order from backend/src/db-seed.ts: General Ledger(0),
        // test(1), Accounts Receivable(2). Within Accounts Receivable:
        // Sale(0), Cash Sale(1), Receipt(2), ..., Customers(9). Real
        // customer contacts aren't scoped to one business — they live as
        // direct children of the one, real, global entity literally
        // named "Customers" (confirmed live via the unscoped
        // GET /entities) — "Cash" and "Riverside Restaurant" (seeded by
        // this tutorial fixture) both really exist there.
        await pressRepeated(terminal, 'Down', 2);
        await press(terminal, 'Enter');
        await terminal.getByText('Sale').expect();
        await press(terminal, 'Enter'); // AR Sale, index 0
        await terminal.getByText('AR Sale — ').expect();

        const saleRef = `TUI-SALE-${Date.now()}`;
        await typeAndEnter(terminal, saleRef);
        await terminal.getByText('Customer').expect();
        await typeAndEnter(terminal, 'Riverside Restaurant');
        await terminal.getByText('Tax %').expect();
        await press(terminal, 'Enter'); // skip — no tax
        await terminal.getByText('Where item lines').expect();
        // Same "Not yet known" NO_LOCATION-first picker as AP Purchase's
        // own location step (Purchase.tsx) — Down once for the first
        // real location.
        await press(terminal, 'Down');
        await press(terminal, 'Enter');
        await terminal.getByText('Optional · Enter continues').expect();
        await press(terminal, 'Enter'); // skip description
        await terminal.getByText('No lines yet').expect();

        await press(terminal, 'i');
        await terminal.getByText('New line').expect();
        await typeAndEnter(terminal, 'Amber Ale 330ml');
        await typeAndEnter(terminal, '4');
        await typeAndEnter(terminal, '15.00');
        await terminal.getByText('Total owed').expect();
        text2 = await terminal.text();
        assert.match(text2, /4\s+\$15\.00/, 'quantity and price should render exactly as typed');
        await press(terminal, 's');
        await terminal.getByText('recorded — ').expect({ timeout: 10_000 });
        await press(terminal, 'Escape');
        await terminal.getByText('Menu — ').expect();

        // --- Menu: Accounts Receivable -> Cash Sale -------------------------
        await pressRepeated(terminal, 'Down', 2);
        await press(terminal, 'Enter');
        await terminal.getByText('Sale').expect();
        await press(terminal, 'Down'); // Cash Sale, index 1
        await press(terminal, 'Enter');
        await terminal.getByText('Cash Sale — ').expect();
        await terminal.getByText('Dispatch from location').expect();
        await press(terminal, 'Enter'); // first real location — no "Not yet known" here
        await terminal.getByText('No lines yet').expect();

        await press(terminal, 'i');
        await terminal.getByText('New line').expect();
        await typeAndEnter(terminal, 'Amber Ale 330ml');
        await typeAndEnter(terminal, '2');
        await typeAndEnter(terminal, '15.00');
        await typeAndEnter(terminal, '1.50');
        await terminal.getByText('Total owed').expect();
        text2 = await terminal.text();
        assert.match(text2, /2\s+\$15\.00\s+\$1\.50/, 'quantity, price, and tax should render exactly as typed');
        await press(terminal, 's');
        await terminal.getByText('payment method').expect();
        await press(terminal, 'Enter'); // Cash
        await terminal.getByText('completed — ').expect({ timeout: 10_000 });
        await press(terminal, 'Escape');
        await terminal.getByText('Menu — ').expect();

        // --- Menu: Accounts Receivable -> Customers -------------------------
        await pressRepeated(terminal, 'Down', 2);
        await press(terminal, 'Enter');
        await terminal.getByText('Sale').expect();
        await pressRepeated(terminal, 'Down', 9); // Customers, index 9
        await press(terminal, 'Enter');
        await terminal.getByText('Customers — ').expect();
        await terminal.getByText('Cash').expect({ timeout: 10_000 });
        text2 = await terminal.text();
        assert.match(text2, /Riverside Restaurant/, 'the real, seeded Riverside Restaurant customer should be listed');
        assert.doesNotMatch(text2, /Hierarchy: Header Account/, 'the generic link/tag child record under the Customers container should be filtered out, not shown as a selectable customer');

        await press(terminal, 'Enter'); // open "Cash" (the first, highlighted customer)
        await terminal.getByText('Email').expect();
        await terminal.getByText('Payment terms (days)').expect();
        await typeAndEnter(terminal, 'cash-desk@example.test');
        await press(terminal, 'Enter'); // keep the existing payment terms (0 — cash only)
        await press(terminal, 'Enter'); // keep the existing (blank) credit limit
        await press(terminal, 'Enter'); // keep the existing reminder level — saves
        await terminal.getByText('Saved Cash.').expect({ timeout: 10_000 });
        await press(terminal, 'Escape');
        await terminal.getByText('Customers — ').expect();
        await press(terminal, 'Escape');
        await terminal.getByText('Menu — ').expect();
      }
    );
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
