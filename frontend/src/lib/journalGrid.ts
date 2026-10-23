// The General Journal entry grid — see docs/pm-frontend-reference.md for
// the full design of each function below.

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
  // Always a magnitude — see docs/pm-frontend-reference.md.
  return Math.round(Math.abs(n) * 100);
}

export function isRowEmpty(row: Row): boolean {
  return !row.account && !row.debit && !row.credit && !row.memo;
}

// See docs/pm-frontend-reference.md.
export function isRowFilled(row: Row): boolean {
  return !!row.account && (toMinorUnits(row.debit) !== 0 || toMinorUnits(row.credit) !== 0);
}

export function activeRows(rows: Row[]): Row[] {
  return rows.filter(isRowFilled);
}

// See docs/pm-frontend-reference.md.
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

// See docs/pm-frontend-reference.md.
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

// See docs/pm-frontend-reference.md.
export function ensureAtLeastOneRow(rows: Row[]): Row[] {
  return rows.length === 0 ? [emptyRow()] : rows;
}

// See docs/pm-frontend-reference.md.
export function addRow(rows: Row[]): Row[] {
  return autoBalanceTrailingRow([...rows, emptyRow()], -1);
}

// See docs/pm-frontend-reference.md.
export function removeRowAt(rows: Row[], index: number): Row[] {
  const next = ensureAtLeastOneRow(rows.filter((_, i) => i !== index));
  return autoBalanceTrailingRow(next, -1);
}

// See docs/pm-frontend-reference.md.
export function computeSuggestedFill(rows: Row[], trailingIndex: number): number | null {
  const others = rows.filter((_, i) => i !== trailingIndex);
  const diff = differenceMinor(others);
  if (diff === 0) return null;
  return Math.abs(diff);
}

// See docs/pm-frontend-reference.md.
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

// See docs/pm-frontend-reference.md.
export function autoExpandIfTrailingRowFilled(rows: Row[]): Row[] {
  const trailing = rows[rows.length - 1];
  if (trailing && isRowFilled(trailing) && differenceMinor(rows) !== 0) {
    return [...rows, emptyRow()];
  }
  return rows;
}
