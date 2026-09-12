/** Parses a currency-amount string into integer minor units — always
 * a non-negative magnitude. A person should never be able to type or
 * see a negative number anywhere in this application; direction
 * (debit vs credit, receipt vs payment) always comes from which field
 * or screen it's entered on, never from a typed minus sign. Invalid
 * or empty input is treated as zero, same as journalGrid's
 * toMinorUnits.
 *
 * NOTE: this always assumes 100 minor units per major unit (a
 * "cents"-style, 2-decimal currency) — real for USD/EUR/GBP and most
 * others, but wrong for a genuinely zero-decimal currency (JPY, KRW)
 * or three-decimal currency (BHD, KWD). decimalPlacesFor(unitCode) in
 * format.ts already has the real, correct per-currency scale — this
 * function doesn't yet take a unit code and apply it. A known,
 * honest gap, not fixed here. */
export function parseMinorUnits(text: string): number {
  const n = Number(text);
  if (!text || !Number.isFinite(n)) return 0;
  return Math.round(Math.abs(n) * 100);
}

/** Same guarantee for a plain (non-money) positive quantity — a
 * negative quantity typed into an order/dispatch/receipt screen makes
 * no more sense than a negative currency amount does. */
export function parseQuantity(text: string): number {
  const n = Number(text);
  if (!text || !Number.isFinite(n)) return 0;
  return Math.round(Math.abs(n));
}
