// Pure logic for a classic General Journal entry grid — no staging
// concept anywhere, no network calls: a row is just {account, debit,
// credit, memo}, the way a bookkeeper actually thinks about a journal
// entry, not "a line I've staged."
//
// Rows are only ever added or removed by an explicit action (Insert/
// Delete, or a person's own click) — never automatically as a side
// effect of typing. An earlier version auto-added a new blank row the
// moment the last row became "filled" (had both an account and an
// amount), which sounds helpful but produced a real, confusing bug:
// filling row 0 auto-suggests row 1's amount before row 1 has an
// account yet, so row 1 doesn't count toward the totals (isRowFilled
// correctly requires both) — but the moment you then pick row 1's
// account, it *becomes* "filled" by that same definition, silently
// spawning an unwanted third row. Removing the auto-expansion removes
// that whole class of surprise.

export interface Row {
  account: string;
  debit: string; // kept as the raw text the person typed, not a number,
  credit: string; // so "12.5" vs "12.50" vs an empty field are distinct
  memo: string;
}

export function emptyRow(): Row {
  return { account: '', debit: '', credit: '', memo: '' };
}

function toMinorUnits(text: string): number {
  const n = Number(text);
  if (!text || !Number.isFinite(n)) return 0;
  // An amount typed here is always a magnitude — direction comes from
  // which column (debit vs credit) it was typed into, never from a
  // minus sign. Without this, typing "-500" into Debit would silently
  // behave like a credit of the same size, and the user should never
  // be able to type or see a negative number at all.
  return Math.round(Math.abs(n) * 100);
}

export function isRowEmpty(row: Row): boolean {
  return !row.account && !row.debit && !row.credit && !row.memo;
}

/** A row only counts toward the entry once it has an account AND an
 * amount — an account with nothing entered yet, or an amount typed into
 * a row with no account chosen, is not yet a real line. This is what
 * lets a still-being-filled-in row sit harmlessly in the grid without
 * being submitted or affecting the balance. */
export function isRowFilled(row: Row): boolean {
  return !!row.account && (toMinorUnits(row.debit) !== 0 || toMinorUnits(row.credit) !== 0);
}

export function activeRows(rows: Row[]): Row[] {
  return rows.filter(isRowFilled);
}

/** Any row with a real amount typed in, regardless of whether an
 * account has been chosen for it yet. This is deliberately looser than
 * activeRows/isRowFilled: the footer totals and the auto-balance
 * suggestion should both reflect an amount the instant it's entered,
 * not wait for an account to also be picked — a found, real gap,
 * where an auto-suggested amount was visibly sitting in a row while
 * the running totals silently excluded it, since it had no account
 * yet. Only isBalanced (below) still needs the stricter, complete-row
 * requirement, since an amount with no account genuinely can't be
 * saved. */
function rowsWithAmount(rows: Row[]): Row[] {
  return rows.filter((r) => toMinorUnits(r.debit) !== 0 || toMinorUnits(r.credit) !== 0);
}

export function debitTotalMinor(rows: Row[]): number {
  return rowsWithAmount(rows).reduce((sum, r) => sum + toMinorUnits(r.debit), 0);
}

export function creditTotalMinor(rows: Row[]): number {
  return rowsWithAmount(rows).reduce((sum, r) => sum + toMinorUnits(r.credit), 0);
}

export function differenceMinor(rows: Row[]): number {
  return debitTotalMinor(rows) - creditTotalMinor(rows);
}

/** A row with a real amount but no account yet — genuinely incomplete,
 * not ready to save even if every amount otherwise balances to zero. */
function hasIncompleteRow(rows: Row[]): boolean {
  return rows.some((r) => (toMinorUnits(r.debit) !== 0 || toMinorUnits(r.credit) !== 0) && !r.account);
}

export function isBalanced(rows: Row[]): boolean {
  const active = activeRows(rows);
  return active.length >= 2 && differenceMinor(rows) === 0 && !hasIncompleteRow(rows);
}

export function canSave(rows: Row[]): boolean {
  return isBalanced(rows);
}

/** Ensures there's always at least one row — used only after removing a
 * row leaves the grid empty, never to auto-add a row as a side effect of
 * typing into an existing one. */
export function ensureAtLeastOneRow(rows: Row[]): Row[] {
  return rows.length === 0 ? [emptyRow()] : rows;
}

/** Adds a new blank row at the end — the explicit action behind the
 * Insert key (or a person's own "add line" gesture), never automatic.
 * Immediately re-suggests the new trailing row's balancing amount,
 * rather than leaving it blank until some OTHER row happens to change
 * again — the entry may already be visibly unbalanced the moment this
 * row appears (a 4th line just added because 3 wasn't enough), and
 * that's exactly when the suggestion is most needed, not a moment
 * later. Passing -1 as the "changed index" guarantees the recompute
 * path always runs, since no real row index is ever negative. */
export function addRow(rows: Row[]): Row[] {
  return autoBalanceTrailingRow([...rows, emptyRow()], -1);
}

/** Removes the row at the given index — the explicit action behind the
 * Delete key. Never lets the grid go completely empty; if removing the
 * last remaining row, replaces it with a fresh blank one instead.
 * Also re-suggests the (possibly new) trailing row's balance — deleting
 * a row changes which rows count as "the others" for balancing
 * purposes, so a previously-correct trailing amount can become stale
 * the instant a different row disappears from under it. */
export function removeRowAt(rows: Row[], index: number): Row[] {
  const next = ensureAtLeastOneRow(rows.filter((_, i) => i !== index));
  return autoBalanceTrailingRow(next, -1);
}

/** What the trailing row's amount *would* need to be to balance the
 * entry, given every other filled row — a suggestion, not something
 * applied without the person's awareness (autoBalanceTrailingRow, below,
 * is what actually applies it). Returns null if there's no real
 * imbalance to suggest filling (nothing else filled in yet, or already
 * balanced), since suggesting "0" isn't a helpful nudge. */
export function computeSuggestedFill(rows: Row[], trailingIndex: number): number | null {
  const others = rows.filter((_, i) => i !== trailingIndex);
  const diff = differenceMinor(others);
  if (diff === 0) return null;
  return Math.abs(diff);
}

/** Auto-fills the LAST row's debit or credit (whichever side balances
 * the entry) whenever some OTHER row changes — not when the edit that
 * just happened was to that last row itself, which is what
 * `changedIndex` tells this function. This distinction matters, and
 * checking "is the trailing row currently empty" is NOT enough to make
 * it correctly (an earlier version of this tried exactly that, and
 * failed a real test): once the trailing row has been auto-filled once,
 * it's no longer empty, so a later edit to some OTHER row would be
 * wrongly treated as "the person is typing into the trailing row" and
 * left stale. Passing the index of whatever row actually just changed
 * resolves this without ambiguity — recompute unless the change was to
 * the last row itself. Deliberately does NOT add or remove any rows —
 * that's a separate, explicit action now (addRow/removeRowAt), never a
 * side effect of this. */
export function autoBalanceTrailingRow(rows: Row[], changedIndex: number): Row[] {
  const trailingIndex = rows.length - 1;
  if (trailingIndex < 0 || changedIndex === trailingIndex) return rows; // don't fight the person actively typing here

  const others = rows.filter((_, i) => i !== trailingIndex);
  const diff = differenceMinor(others);
  const trailing = rows[trailingIndex];
  if (diff === 0) return rows.map((r, i) => (i === trailingIndex ? { ...trailing, debit: '', credit: '' } : r));

  const amount = (Math.abs(diff) / 100).toFixed(2);
  const updatedTrailing: Row = diff > 0 ? { ...trailing, debit: '', credit: amount } : { ...trailing, debit: amount, credit: '' };

  return rows.map((r, i) => (i === trailingIndex ? updatedTrailing : r));
}

/** Appends a new blank row only when BOTH the current last row has
 * genuinely become complete (an account chosen AND a real amount) AND
 * the entry is still unbalanced afterward — if the rows already
 * balance to zero the moment that row fills in, nothing more is
 * needed, and adding a row anyway is unwanted clutter. A new row
 * reappears later on its own the normal way (autoBalanceTrailingRow)
 * if editing an amount throws the entry out of balance again.
 *
 * Deliberately narrow, to avoid the exact historical bug this project
 * hit before: checking only the TRAILING row (never some other row
 * that happens to become filled) means this can only ever add one row
 * at a time, and only right when it's actually needed. */
export function autoExpandIfTrailingRowFilled(rows: Row[]): Row[] {
  const trailing = rows[rows.length - 1];
  if (trailing && isRowFilled(trailing) && differenceMinor(rows) !== 0) {
    return [...rows, emptyRow()];
  }
  return rows;
}
