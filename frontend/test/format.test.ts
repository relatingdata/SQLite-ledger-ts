import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatAmount, formatDate } from '../src/lib/format.ts';

test('formatAmount applies each explicit pattern directly — never Intl locale inference', () => {
  assert.equal(formatAmount(100000000, '1,000.00'), '1,000,000.00');
  assert.equal(formatAmount(100000000, '1 000.00'), '1 000 000.00', 'the actual point of this whole feature — a real space, not a comma');
  assert.equal(formatAmount(100000000, '1.000,00'), '1.000.000,00');
  assert.equal(formatAmount(100000000, '1000,00'), '1000000,00');
  assert.equal(formatAmount(100000000, "1'000.00"), "1'000'000.00");
  assert.equal(formatAmount(100000000, '1000.00'), '1000000.00');
});

test('formatAmount respects a currency\'s real ISO 4217 precision when an explicit unit code is given — zero-decimal, three-decimal, and the ordinary two-decimal default all correct', () => {
  assert.equal(formatAmount(100000, '1,000.00', 'JPY'), '100,000', 'JPY has no minor unit at all — no decimal point, not "1,000.00 yen and 00 sen"');
  assert.equal(formatAmount(1500, '1,000.00', 'BHD'), '1.500', 'BHD uses three decimal places, not two');
  assert.equal(formatAmount(123456, '1,000.00', 'USD'), '1,234.56', 'an ordinary currency must format identically whether or not the unit code is passed');
  assert.equal(formatAmount(123456, '1,000.00'), '1,234.56', 'and omitting the unit code entirely must still give the exact same, unchanged result');
});

test('formatAmount\'s unit-code mechanism generalizes beyond currency — any unit with its own real precision, same lookup', () => {
  assert.equal(formatAmount(1234567, '1 000.00', 'JPY'), '1 234 567', 'a large zero-decimal amount groups correctly with no trailing decimal point');
  assert.equal(formatAmount(-1500, '1,000.00', 'BHD'), '(1.500)', 'a negative three-decimal amount uses standard accounting parentheses, not a leading minus sign');
});

test('formatAmount handles small amounts, negatives, and zero correctly under every pattern', () => {
  assert.equal(formatAmount(150, '1 000.00'), '1.50');
  assert.equal(formatAmount(-150, '1 000.00'), '(1.50)', 'a negative amount must show in standard accounting parentheses, not a leading minus sign — a real, reported issue');
  assert.equal(formatAmount(0, '1 000.00'), '0.00');
  assert.equal(formatAmount(5, '1 000.00'), '0.05', 'a sub-dollar amount must still show both decimal places');
});

test('formatDate applies each explicit pattern directly to a real ISO date', () => {
  assert.equal(formatDate('2027-08-03', 'dd/mm/yyyy'), '03/08/2027', 'day-first — the actual Australian convention this defaults to');
  assert.equal(formatDate('2027-08-03', 'mm/dd/yyyy'), '08/03/2027');
  assert.equal(formatDate('2027-08-03', 'dd.mm.yyyy'), '03.08.2027');
  assert.equal(formatDate('2027-08-03', 'dd-mm-yyyy'), '03-08-2027');
  assert.equal(formatDate('2027-08-03', 'yyyy-mm-dd'), '2027-08-03');
});

test('formatDate handles null/undefined/empty gracefully, and a datetime string by taking just the date item', () => {
  assert.equal(formatDate(null, 'dd/mm/yyyy'), '');
  assert.equal(formatDate(undefined, 'dd/mm/yyyy'), '');
  assert.equal(formatDate('', 'dd/mm/yyyy'), '');
  assert.equal(formatDate('2027-08-03T14:30:00Z', 'dd/mm/yyyy'), '03/08/2027', 'a full timestamp must still format correctly, using only its date portion');
});
