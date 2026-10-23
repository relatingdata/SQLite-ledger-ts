// Row expansion is explicit (addRow/removeRowAt) only — no auto-added blank row.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyRow,
  isRowEmpty,
  isRowFilled,
  activeRows,
  debitTotalMinor,
  creditTotalMinor,
  isBalanced,
  differenceMinor,
  canSave,
  addRow,
  removeRowAt,
  ensureAtLeastOneRow,
  computeSuggestedFill,
  autoBalanceTrailingRow,
  autoExpandIfTrailingRowFilled,
  type Row,
} from '../src/lib/journalGrid.ts';

test('an empty row is empty and not filled', () => {
  const r = emptyRow();
  assert.equal(isRowEmpty(r), true);
  assert.equal(isRowFilled(r), false);
});

test('a row needs both an account and a nonzero amount to count as filled', () => {
  assert.equal(isRowFilled({ account: '', debit: '100', credit: '', memo: '' }), false, 'amount with no account is not a real line');
  assert.equal(isRowFilled({ account: 'Cash and Bank', debit: '', credit: '', memo: '' }), false, 'account with no amount is not a real line');
  assert.equal(isRowFilled({ account: 'Cash and Bank', debit: '100', credit: '', memo: '' }), true);
});

test('debit/credit totals only count active (filled) rows', () => {
  const rows: Row[] = [
    { account: 'Cash and Bank', debit: '100', credit: '', memo: '' },
    { account: '', debit: '', credit: '', memo: '' },
  ];
  assert.equal(debitTotalMinor(rows), 10000);
  assert.equal(creditTotalMinor(rows), 0);
  assert.equal(activeRows(rows).length, 1);
});

test('isBalanced requires at least two real rows and an exact zero difference', () => {
  const oneRow: Row[] = [{ account: 'Cash and Bank', debit: '100', credit: '', memo: '' }];
  assert.equal(isBalanced(oneRow), false, 'a single line is never a valid entry, even if trivially "balanced"');

  const balanced: Row[] = [
    { account: 'Cash and Bank', debit: '100', credit: '', memo: '' },
    { account: 'Sales Revenue', debit: '', credit: '100', memo: '' },
  ];
  assert.equal(isBalanced(balanced), true);
  assert.equal(canSave(balanced), true);

  const unbalanced: Row[] = [
    { account: 'Cash and Bank', debit: '100', credit: '', memo: '' },
    { account: 'Sales Revenue', debit: '', credit: '99.99', memo: '' },
  ];
  assert.equal(isBalanced(unbalanced), false);
});

test('addRow/removeRowAt are the only ways the row count changes — never automatic', () => {
  const rows: Row[] = [{ account: 'Cash and Bank', debit: '100', credit: '', memo: '' }];
  const withNewRow = addRow(rows);
  assert.equal(withNewRow.length, 2);
  // The new row is pre-filled with the suggested balancing amount
  // (100.00 credit) rather than left empty — the entry is visibly
  // unbalanced the moment this row appears, and that's exactly when
  // the suggestion is needed, not a moment later. Still has no
  // account chosen, so it doesn't count as "filled" for saving yet.
  assert.equal(withNewRow[1].credit, '100.00');
  assert.equal(withNewRow[1].account, '');
  assert.equal(isRowFilled(withNewRow[1]), false);

  const removed = removeRowAt(withNewRow, 1);
  assert.equal(removed.length, 1);

  // Removing the only remaining row leaves exactly one blank row, never zero.
  const removedLast = removeRowAt(removed, 0);
  assert.equal(removedLast.length, 1);
  assert.equal(isRowEmpty(removedLast[0]), true);
});

test('ensureAtLeastOneRow is a no-op on a non-empty grid and adds exactly one row to an empty one', () => {
  const rows: Row[] = [{ account: 'Cash and Bank', debit: '100', credit: '', memo: '' }];
  assert.deepEqual(ensureAtLeastOneRow(rows), rows);
  assert.equal(ensureAtLeastOneRow([]).length, 1);
});

test('computeSuggestedFill returns the amount needed to balance, or null if nothing to suggest', () => {
  const rows: Row[] = [{ account: 'Cash and Bank', debit: '100', credit: '', memo: '' }, emptyRow()];
  assert.equal(computeSuggestedFill(rows, 1), 10000);

  const alreadyBalanced: Row[] = [
    { account: 'Cash and Bank', debit: '100', credit: '', memo: '' },
    { account: 'Sales Revenue', debit: '', credit: '100', memo: '' },
    emptyRow(),
  ];
  assert.equal(computeSuggestedFill(alreadyBalanced, 2), null, 'nothing to suggest once the other rows already balance each other');
});

test('autoBalanceTrailingRow fills the last row to the correct side and amount, without changing the row count', () => {
  const rows: Row[] = [{ account: 'Cash and Bank', debit: '100', credit: '', memo: '' }, emptyRow()];
  const result = autoBalanceTrailingRow(rows, 0);
  assert.equal(result.length, 2, 'row count must not change — that is addRow/removeRowAt\'s job now, not this function\'s');
  assert.equal(result[1].credit, '100.00');
  assert.equal(result[1].debit, '');
});

test('autoBalanceTrailingRow never overwrites the last row when the edit that just happened was to that row itself', () => {
  const rows: Row[] = [
    { account: 'Cash and Bank', debit: '100', credit: '', memo: '' },
    { account: 'Sales Tax Payable', debit: '', credit: '5', memo: 'partial entry' },
  ];
  const result = autoBalanceTrailingRow(rows, 1); // the edit was to row 1, the last row itself
  assert.equal(result[1].credit, '5', 'must not overwrite the row the person is directly editing');
});

test('the exact feedback-loop bug from before: changing an already-filled row must not use its own stale value', () => {
  let rows: Row[] = [{ account: 'Cash and Bank', debit: '100', credit: '', memo: '' }, emptyRow()];
  rows = autoBalanceTrailingRow(rows, 0);
  assert.equal(rows[1].credit, '100.00');

  rows[0] = { ...rows[0], debit: '250' };
  const result = autoBalanceTrailingRow(rows, 0);
  assert.equal(result[1].credit, '250.00', 'must reflect the new 250, not a stale 150 or a stale 100');
});

test('the exact bug just fixed: picking an account for the auto-balanced trailing row must not spawn a new row', () => {
  // This is the precise scenario from the real bug report: fill row 0
  // completely (account + amount), which auto-suggests row 1's amount;
  // then pick row 1's account. Before the fix, row 1 becoming "filled"
  // at that point silently triggered a third row to appear. Now,
  // nothing adds a row unless addRow is called explicitly — which nothing
  // here does.
  let rows: Row[] = [emptyRow(), emptyRow()];
  rows[0] = { ...rows[0], account: 'Cash and Bank', debit: '100' };
  rows = autoBalanceTrailingRow(rows, 0);
  assert.equal(rows.length, 2, 'still exactly two rows after the amount auto-fills');
  assert.equal(rows[1].credit, '100.00');

  // Now pick row 1's account — this alone must not change the row count.
  rows[1] = { ...rows[1], account: 'Sales Revenue' };
  assert.equal(rows.length, 2, 'picking the second row\'s account must not spawn a third row');

  // And now that both rows are genuinely filled, the totals/balance must
  // actually reflect it — the other half of the original complaint.
  assert.equal(debitTotalMinor(rows), 10000);
  assert.equal(creditTotalMinor(rows), 10000);
  assert.equal(isBalanced(rows), true, 'the entry must now correctly show as balanced, not stuck on "out of balance"');
});

test('the real bug just fixed: building a 4-line entry incrementally (Cash, Revenue, COGS, then realizing Rent is still needed) must correctly suggest the remaining amount the instant Insert is pressed, not leave the new row blank', () => {
  let rows: Row[] = [emptyRow(), emptyRow()];

  rows[0] = { ...rows[0], account: 'Cash and Bank', debit: '200' };
  rows = autoBalanceTrailingRow(rows, 0);

  rows = addRow(rows); // a person realizes 2 rows won't be enough
  rows[1] = { ...rows[1], account: 'Sales Revenue', credit: '2000' };
  rows = autoBalanceTrailingRow(rows, 1);

  // Types the REAL COGS value directly into what's currently the
  // trailing row — the natural thing to do, since nothing yet
  // indicates a 4th row will be needed.
  rows[2] = { ...rows[2], account: 'Cost of Goods Sold', debit: '1000' };
  rows = autoBalanceTrailingRow(rows, 2);
  assert.equal(isBalanced(rows), false, 'genuinely unbalanced at this point — Rent has not been entered yet');

  // Pressing Insert must IMMEDIATELY suggest the correct remaining
  // amount on the new row — not leave it blank until some other row
  // happens to change again, which may never happen once every other
  // row already holds its final, correct value.
  rows = addRow(rows);
  const newTrailingRow = rows[rows.length - 1];
  assert.equal(newTrailingRow.debit, '800.00', 'the remaining amount needed (Rent) must be pre-filled the instant the row appears');
  assert.equal(newTrailingRow.credit, '');

  rows[3] = { ...rows[3], account: 'Rent' };
  assert.equal(isBalanced(rows), true, 'picking the account for the already-correctly-amounted row completes a valid, balanced 4-line entry');
  assert.equal(debitTotalMinor(rows), 200000);
  assert.equal(creditTotalMinor(rows), 200000);
});

test('the real reported bug: an auto-suggested amount must count toward the visible running totals immediately, even before its row has an account chosen', () => {
  let rows: Row[] = [emptyRow(), emptyRow()];
  rows[0] = { ...rows[0], account: 'Cash and Bank', debit: '500' };
  rows = autoBalanceTrailingRow(rows, 0);

  // The trailing row now shows the correct auto-suggested credit —
  // but critically, it has NO account chosen yet.
  assert.equal(rows[1].credit, '500.00');
  assert.equal(rows[1].account, '');

  // The footer totals must already reflect this, not wait for an
  // account to also be picked — this was the actual reported gap:
  // the number was visibly there, but the totals silently excluded it.
  assert.equal(debitTotalMinor(rows), 50000);
  assert.equal(creditTotalMinor(rows), 50000, 'the auto-suggested amount must count immediately, before any account is chosen for that row');
  assert.equal(differenceMinor(rows), 0);

  // But it must still correctly refuse to save until the account is
  // actually picked — an amount with no account can't be posted.
  assert.equal(isBalanced(rows), false, 'not yet save-able — row 1 has an amount but no account');

  rows[1] = { ...rows[1], account: 'Sales Revenue' };
  assert.equal(isBalanced(rows), true, 'now genuinely complete and balanced');
});

test('the requested "just keep typing" workflow: completing the last row reveals a new one only if the entry is STILL unbalanced — not just because a row became filled', () => {
  function onRowChanged(rows: Row[], index: number): Row[] {
    rows = autoExpandIfTrailingRowFilled(rows);
    rows = autoBalanceTrailingRow(rows, index);
    return rows;
  }

  let rows: Row[] = [emptyRow()];
  assert.equal(rows.length, 1);

  rows[0] = { ...rows[0], account: 'Cash and Bank', debit: '500' };
  rows = onRowChanged(rows, 0);
  assert.equal(rows.length, 2, 'completing the only row reveals a second one automatically');
  assert.equal(rows[1].credit, '500.00', 'the new trailing row is immediately suggested a balancing amount');
  assert.equal(rows[1].account, '', 'but has no account chosen yet — not "filled" on its own');

  // The exact historical bug scenario, refined: picking the account
  // for the already-auto-suggested row must NOT spawn a third row —
  // the entry already balances at exactly two lines, so a third would
  // be unwanted clutter, not a helpful next step.
  rows[1] = { ...rows[1], account: 'Sales Revenue' };
  rows = onRowChanged(rows, 1);
  assert.equal(rows.length, 2, 'must stay at exactly two rows — the entry is already balanced, nothing more is needed');
  assert.equal(isBalanced(rows), true);

  // Touching an already-filled, already-balanced row again (a memo,
  // say) must never cause growth either.
  rows[1] = { ...rows[1], memo: 'a note' };
  rows = onRowChanged(rows, 1);
  assert.equal(rows.length, 2, 'must still be exactly two rows');

  // NOW break the balance by editing the amount — this is genuinely
  // the case a new row should appear for, since more lines are needed
  // to reach zero again.
  rows[1] = { ...rows[1], credit: '300' };
  rows = onRowChanged(rows, 1);
  assert.equal(rows.length, 3, 'editing the amount to leave the entry unbalanced must reveal a new row');
  assert.equal(rows[2].credit, '200.00', 'the new row is correctly suggested the remaining 200.00');
  assert.equal(isBalanced(rows), false, 'genuinely unbalanced until the new row also gets an account');
});

test('typing a negative number into an amount field is never treated as negative — direction comes from which column, never from a typed minus sign', () => {
  const rows: Row[] = [
    { account: 'Cash and Bank', debit: '-500', credit: '', memo: '' },
    { account: 'Sales Revenue', debit: '', credit: '500', memo: '' },
  ];
  // If the minus sign were honored, this would net to -500 - 500 = -1000
  // debit total (or worse, silently flip debit into an effective
  // credit) — instead it must be treated as a plain 500.00 magnitude,
  // exactly as if no minus sign had been typed at all.
  assert.equal(debitTotalMinor(rows), 50000, 'a typed minus sign must never produce a negative amount');
  assert.equal(creditTotalMinor(rows), 50000);
  assert.equal(isBalanced(rows), true);
});
