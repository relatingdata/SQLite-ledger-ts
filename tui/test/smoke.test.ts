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
      }
    );
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
