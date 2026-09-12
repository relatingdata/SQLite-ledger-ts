/**
 * Prototype: currency/unit-aware decimal precision. The real gap this
 * fixes: formatAmount and the "amount_minor" storage convention both
 * hardcode "divide by 100, 2 decimal places" everywhere. Real
 * currencies vary (JPY: 0 decimal places, BHD: 3), and the person
 * asked directly whether the same idea should generalize beyond
 * currency to any unit of measure.
 *
 * The integer, smallest-unit storage convention itself stays correct
 * and unchanged — that's the right way to avoid floating-point bugs
 * regardless of how many decimal places a given unit uses. What
 * changes is: how many smallest-units make up "one" of a given
 * currency/unit, looked up per unit rather than hardcoded as 100
 * everywhere.
 *
 * Verified against ISO 4217's real minor-unit data (confirmed via
 * search, not assumed): zero-decimal currencies (JPY, KRW, ISK, VND,
 * etc.) and three-decimal currencies (BHD, KWD, OMR, JOD, etc.) are
 * real, standardized exceptions to the "2 decimal places" default,
 * not edge cases to special-case ad hoc.
 *
 * Run with: node --import tsx backend/scripts/prototype-currency-precision.ts
 */

// A general lookup: how many smallest-units make up "one" of a given
// unit code. Only the real exceptions are listed — everything else
// (the vast majority of currencies, and any other unit) defaults to
// 100 (2 decimal places), matching the existing behavior unless a
// specific unit genuinely needs something else.
const UNIT_SCALE: Record<string, number> = {
  // Zero decimal places (ISO 4217 minor unit = 0) — confirmed via search.
  BIF: 1, CLF: 10000, DJF: 1, GNF: 1, ISK: 1, JPY: 1, KMF: 1, KRW: 1,
  PYG: 1, RWF: 1, UGX: 1, VND: 1, VUV: 1, XAF: 1, XOF: 1, XPF: 1,
  // Three decimal places (ISO 4217 minor unit = 3) — confirmed via search.
  BHD: 1000, IQD: 1000, JOD: 1000, KWD: 1000, LYD: 1000, OMR: 1000, TND: 1000,
  // A real, non-currency example proving the generalization: whole
  // bottles only, never a fraction of one — a quantity unit, not a
  // currency, using the exact same lookup mechanism.
  BOTTLE: 1,
};

/** Smallest-units-per-one for a given unit code. Falls back to 100
 * (2 decimal places) for the vast majority of currencies, and for any
 * unit not explicitly listed — the existing, correct default,
 * unchanged, not silently altered for units that were already right. */
function scaleFor(unitCode: string): number {
  return UNIT_SCALE[unitCode] ?? 100;
}

function decimalPlacesFor(unitCode: string): number {
  const scale = scaleFor(unitCode);
  return Math.round(Math.log10(scale));
}

/** The corrected formatAmount — same number-format patterns as
 * before (1,000.00 / 1 000.00 / etc.), but the grouping/decimal
 * SEPARATOR characters come from the pattern while the actual number
 * of decimal places comes from the unit's own real scale. */
function formatAmountForUnit(smallestUnits: number, unitCode: string, numberFormat: string): string {
  const scale = scaleFor(unitCode);
  const decimals = decimalPlacesFor(unitCode);
  const negative = smallestUnits < 0;
  const abs = Math.abs(Math.round(smallestUnits));
  const whole = Math.floor(abs / scale).toString();
  const dec = decimals > 0 ? (abs % scale).toString().padStart(decimals, '0') : '';

  let groupSep: string, decimalSep: string;
  switch (numberFormat) {
    case '1,000.00': groupSep = ','; decimalSep = '.'; break;
    case '1 000.00': groupSep = ' '; decimalSep = '.'; break;
    case '1.000,00': groupSep = '.'; decimalSep = ','; break;
    case '1000,00': groupSep = ''; decimalSep = ','; break;
    case "1'000.00": groupSep = "'"; decimalSep = '.'; break;
    default: groupSep = ''; decimalSep = '.'; break;
  }
  const grouped = groupSep ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, groupSep) : whole;
  const result = decimals > 0 ? `${grouped}${decimalSep}${dec}` : grouped;
  return negative ? `-${result}` : result;
}

function main() {
  console.log('=== Zero-decimal currency: JPY ===');
  // 100000 smallest-units of JPY (scale 1) = 100,000 yen exactly, not 1,000.00
  const jpy = formatAmountForUnit(100000, 'JPY', '1,000.00');
  console.log('100000 JPY smallest-units ->', jpy, '(expect 100,000 — no decimal point at all)');
  if (jpy !== '100,000') throw new Error('PROTOTYPE FAILURE: JPY formatting wrong');

  console.log('\n=== Three-decimal currency: BHD ===');
  // 1500 smallest-units of BHD (scale 1000) = 1.500 BHD
  const bhd = formatAmountForUnit(1500, 'BHD', '1,000.00');
  console.log('1500 BHD smallest-units ->', bhd, '(expect 1.500 — three decimal places, not two)');
  if (bhd !== '1.500') throw new Error('PROTOTYPE FAILURE: BHD formatting wrong');

  console.log('\n=== Ordinary two-decimal currency: USD, completely unaffected ===');
  const usd = formatAmountForUnit(123456, 'USD', '1,000.00');
  console.log('123456 USD smallest-units ->', usd, '(expect 1,234.56 — the existing, correct behavior, unchanged)');
  if (usd !== '1,234.56') throw new Error('PROTOTYPE FAILURE: USD formatting must be completely unaffected');

  console.log('\n=== The generalization: a non-currency unit using the exact same mechanism ===');
  const bottles = formatAmountForUnit(48, 'BOTTLE', '1,000.00');
  console.log('48 BOTTLE smallest-units ->', bottles, "(expect 48 — whole bottles only, same mechanism as JPY's whole yen)");
  if (bottles !== '48') throw new Error('PROTOTYPE FAILURE: BOTTLE (a non-currency unit) formatting wrong');

  console.log('\n=== A large, real-world JPY amount, to catch a rounding/grouping edge case ===');
  const largeJpy = formatAmountForUnit(1234567, 'JPY', '1 000.00');
  console.log('1234567 JPY smallest-units, space-separated format ->', largeJpy, '(expect 1 234 567)');
  if (largeJpy !== '1 234 567') throw new Error('PROTOTYPE FAILURE: large JPY amount with space grouping wrong');

  console.log('\n=== ALL SCENARIOS PASSED — currency/unit precision is a real, general, verified mechanism ===');
}

main();
