// Shared keystroke-driving helpers for step-runner.ts's `--path text`
// mode. Extracted out of tui/test/smoke.test.ts, which now imports this
// same module rather than keeping its own copy — one real implementation
// of the settle-delay/paste-detection workarounds below, not two that can
// drift apart. See docs/tui-design.md and docs/pm-testing-e2e.md.
//
// `@microsoft/tui-test` isn't declared as a dependency of this package
// (backend/) any more than `playwright` already is, just above this file
// in step-runner.ts — both resolve via this repo's npm workspace hoisting
// (root node_modules), the same, real, already-established pattern.
import type { TuiTest } from '@microsoft/tui-test';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A single key press plus a real, settle delay. A key fired the instant
 * a screen's text first appears can still occasionally race the
 * component actually attaching its own input listener — confirmed live,
 * repeatedly, during tui/test/smoke.test.ts's own development. Every key
 * press in this module goes through this one, settled wrapper rather
 * than the raw client call. */
export async function press(terminal: TuiTest, key: string): Promise<void> {
  await terminal.keyboard.press(key);
  await sleep(100);
}

/** A repeated arrow key is just as capable of landing two presses in the
 * same native-side read as a run of character keys, silently selecting
 * the wrong list item — same real reason typeAndEnter below paces
 * character keys. */
export async function pressRepeated(terminal: TuiTest, key: string, times: number): Promise<void> {
  for (let i = 0; i < times; i++) {
    await terminal.keyboard.press(key);
    await sleep(30);
  }
}

/** `terminal.submit()`/`.type()` write the whole string as one chunk,
 * which trips Ink's own paste-detection heuristic (any multi-character
 * chunk arriving in a single `data` event is treated as a paste, not
 * discrete keystrokes). A single `keyboard.press(...chars)` call for the
 * whole string has the same problem — confirmed live, it occasionally
 * drops or duplicates a character (e.g. "admin" arriving as "adminm") —
 * because nothing paces the keys it sends. A real, explicit delay
 * between each discrete key press, confirmed live to fix it, is what
 * actually avoids this. */
export async function typeAndEnter(terminal: TuiTest, text: string): Promise<void> {
  for (const ch of text) {
    await terminal.keyboard.press(ch);
    await sleep(30);
  }
  await sleep(30);
  await press(terminal, 'Enter');
}

/** Moves the highlight down, one settled press at a time, until it lands
 * on a line containing `labelSubstring`, returning whether it was found
 * — robust against a list whose exact contents/order this driver
 * doesn't fully control (a real business's own, real, pre-existing data
 * alongside whatever this run just created), without parsing the
 * panel's own box-drawing border characters to compute an index by
 * hand, and without needing to know in advance whether `labelSubstring`
 * is even in this particular list (see navigateMenuGenerically below,
 * which relies on a real "not found" instead of a thrown error to try
 * the next section). Leaves the highlight wherever it lands either way
 * — on a genuine find, exactly on the matching line; otherwise wherever
 * `maxSteps` Down presses ended up, which callers that care should
 * explicitly reset (e.g. Escape back out) rather than assume.
 *
 * Checks for BOTH of this project's two real, live highlight markers —
 * '›' (U+203A), used by every hand-rolled line-item list, e.g.
 * Purchase.tsx/GeneralJournal.tsx's own running lines), and '❯'
 * (U+276F, `figures.pointer`), which `ink-select-input` itself renders
 * for every screen that uses it instead (Menu, ChooseBusiness, and any
 * other plain picker list) — confirmed live: checking only '›' means
 * this function never finds a real match on an ink-select-input
 * screen, so it silently exhausts `maxSteps` Down presses and returns
 * false every time, leaving the highlight wherever the (often even)
 * press count happened to land — exactly the bug that made
 * navigateMenuGenerically appear to "pick" an unrelated top item (e.g.
 * landing back on a list's own first entry after a wrapped-around,
 * even number of Down presses) rather than ever genuinely finding the
 * requested item. */
export async function findItemByText(terminal: TuiTest, labelSubstring: string, maxSteps = 30): Promise<boolean> {
  for (let i = 0; i < maxSteps; i++) {
    const lines = (await terminal.text()).split('\n');
    if (lines.some((l) => (l.includes('›') || l.includes('❯')) && l.includes(labelSubstring))) return true;
    await press(terminal, 'Down');
  }
  return false;
}

/** Same as findItemByText, but throws when nothing matches — for a
 * caller that already knows the item must be there. */
export async function selectItemByText(terminal: TuiTest, labelSubstring: string, maxSteps = 30): Promise<void> {
  const found = await findItemByText(terminal, labelSubstring, maxSteps);
  if (!found) throw new Error(`selectItemByText: never found a highlighted line containing "${labelSubstring}" within ${maxSteps} Down presses`);
}

// The real, current number of top-level Menu sections (General
// Ledger/Accounts Receivable/Accounts Payable/Inventory/Cash/
// Configuration/...), read directly from backend/src/db-seed.ts's own,
// real, hand-authored seed order. Generic across every screen — never
// specific to any one of them — purely a property of the Menu itself,
// the same way runStepViaUi's own hardcoded 2000ms post-submit margin
// is a property of the web app, not of any one screen.
const TOP_LEVEL_SECTION_COUNT = 12;

/** Finds and opens a screen from the Menu's own top level, by on-screen
 * text alone — never a hardcoded Down-count naming a specific screen,
 * never a screen_name special case. The Menu component
 * (tui/src/screens/Menu.tsx) remounts fresh — resetting its own
 * activeSection to null — every single time App.tsx's screen union
 * returns to 'menu' via a screen's own onBack(), so "press Escape, land
 * back at the top level's own index 0" is a real, reliable, generic
 * reset this can lean on between attempts; there is no "deep link" the
 * way the `ui` path's own open_selector sometimes provides.
 *
 * Tries each of the real, current top-level sections in turn: opens
 * it, searches its own item list for `screenLabel` (findItemByText),
 * and either opens the match or backs out and tries the next section.
 * Throws, rather than guessing, if `screenLabel` isn't found in any of
 * them — most commonly because the TUI's own on-screen menu label
 * doesn't actually match `screenLabel` (see "Known gap: TUI screen
 * granularity doesn't match screens.csv", docs/pm-testing-e2e.md). */
export async function navigateMenuGenerically(terminal: TuiTest, screenLabel: string): Promise<void> {
  await terminal.getByText('Menu — ').expect();
  for (let section = 0; section < TOP_LEVEL_SECTION_COUNT; section++) {
    if (section > 0) await pressRepeated(terminal, 'Down', section);
    await press(terminal, 'Enter');
    const found = await findItemByText(terminal, screenLabel, 20);
    if (found) {
      await press(terminal, 'Enter');
      return;
    }
    await press(terminal, 'Escape');
    await terminal.getByText('Menu — ').expect();
  }
  throw new Error(
    `navigateMenuGenerically: no menu item matching "${screenLabel}" found in any of the ${TOP_LEVEL_SECTION_COUNT} top-level Menu sections. Most likely the TUI's own on-screen label for this screen doesn't match screen_name exactly — see "Known gap: TUI screen granularity doesn't match screens.csv" in docs/pm-testing-e2e.md.`
  );
}
