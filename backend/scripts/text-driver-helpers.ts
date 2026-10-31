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

/** Moves the highlight ('› ') down, one settled press at a time, until it
 * lands on a line containing `labelSubstring` — robust against a list
 * whose exact contents/order this driver doesn't fully control (a real
 * business's own, real, pre-existing data alongside whatever this run
 * just created), without parsing the panel's own box-drawing border
 * characters to compute an index by hand. */
export async function selectItemByText(terminal: TuiTest, labelSubstring: string, maxSteps = 30): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    const lines = (await terminal.text()).split('\n');
    if (lines.some((l) => l.includes('›') && l.includes(labelSubstring))) return;
    await press(terminal, 'Down');
  }
  throw new Error(`selectItemByText: never found a highlighted line containing "${labelSubstring}" within ${maxSteps} Down presses`);
}

// The Menu component (tui/src/screens/Menu.tsx) remounts fresh —
// resetting its own activeSection to null — every single time App.tsx's
// screen union returns to 'menu' via a screen's own onBack(). So every
// navigation from the top-level menu down into a given screen is the
// exact, same, fixed keystroke sequence each time: Down `topLevelDowns`
// times to the right top-level section, Enter, Down `sectionDowns` times
// to the right screen within that section, Enter. There is no "deep
// link" the way the `ui` path's own open_selector sometimes provides.
//
// `topLevelDowns`/`sectionDowns` are read directly from
// backend/src/db-seed.ts's own, real, hand-authored seed order — the
// same, real way tui/test/smoke.test.ts's own comments document each
// one — never guessed or computed from on-screen text, since a freshly-
// mounted list always starts back at its own index 0.
export async function navigateToScreen(
  terminal: TuiTest,
  expectedScreenHeaderPrefix: string,
  topLevelDowns: number,
  sectionDowns: number
): Promise<void> {
  await terminal.getByText('Menu — ').expect();
  await pressRepeated(terminal, 'Down', topLevelDowns);
  await press(terminal, 'Enter');
  await pressRepeated(terminal, 'Down', sectionDowns);
  await press(terminal, 'Enter');
  await terminal.getByText(expectedScreenHeaderPrefix).expect();
}
