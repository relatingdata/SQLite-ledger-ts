/** Today's date in the form every date input/report parameter here
 * expects (YYYY-MM-DD). A real, shared default — several report pages
 * independently need "today" as a sensible starting point rather than
 * an empty date, which silently means "show all of history including
 * transactions after any close" instead of a meaningful snapshot. */
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * How many smallest-units make up "one" of a given unit code — a
 * general concept, not currency-specific, even though currency is
 * the immediate, concrete need. Only real exceptions are listed;
 * everything else (the vast majority of currencies, and any other
 * unit) defaults to 100 (2 decimal places) via scaleFor below,
 * matching this app's existing behavior unchanged for anything not
 * explicitly listed here.
 *
 * Currency entries verified against ISO 4217's real minor-unit data,
 * not assumed: most currencies use 2 decimal places, but a real,
 * standardized set of exceptions exist — JPY, KRW, ISK, VND, and
 * others have no minor unit at all (whole-number amounts only);
 * BHD, KWD, OMR, JOD, and others use three decimal places, not two.
 */
const UNIT_SCALE: Record<string, number> = {
  // Zero decimal places (ISO 4217 minor unit = 0).
  BIF: 1, CLF: 10000, DJF: 1, GNF: 1, ISK: 1, JPY: 1, KMF: 1, KRW: 1,
  PYG: 1, RWF: 1, UGX: 1, VND: 1, VUV: 1, XAF: 1, XOF: 1, XPF: 1,
  // Three decimal places (ISO 4217 minor unit = 3).
  BHD: 1000, IQD: 1000, JOD: 1000, KWD: 1000, LYD: 1000, OMR: 1000, TND: 1000,
};

/** Smallest-units-per-one for a given unit code — falls back to 100
 * (2 decimal places) for any currency or other unit not explicitly
 * listed above, the existing, correct default for the overwhelming
 * majority of real-world units. */
function scaleFor(unitCode: string | undefined): number {
  if (!unitCode) return 100;
  return UNIT_SCALE[unitCode] ?? 100;
}

/** How many decimal places a given unit's amounts should actually
 * show — 0 for JPY, 3 for BHD, 2 for the ordinary default. Exported
 * for anything that needs to know this directly (e.g. constraining an
 * amount input's own step/precision for a specific currency), not
 * just for formatAmount's own internal use. */
export function decimalPlacesFor(unitCode: string | undefined): number {
  return Math.round(Math.log10(scaleFor(unitCode)));
}

/**
 * Applies the user's own explicit number_format pattern directly —
 * never Intl locale inference, which is exactly what got this wrong
 * in the first place (Intl.NumberFormat('en-AU') actually produces
 * commas, not the space this business's real convention uses).
 *
 * Deliberately takes numberFormat as a required parameter rather than
 * reaching into the auth store itself — keeps this a pure, easily
 * testable function; callers (Svelte components) pass
 * auth.current?.user.number_format ?? '1 000.00' themselves.
 *
 * smallestUnits is always the input (this app's amounts are always
 * stored as an integer count of the smallest real subdivision — cents
 * for most currencies, but not every currency has cents: JPY has none
 * at all, BHD has a smaller one still). unitCode is optional — omit it
 * for the ordinary case (the business's own home currency, or any
 * currency using the standard 2 decimal places), matching this
 * function's exact previous behavior unchanged; pass an ISO 4217 code
 * to get that currency's own real precision instead.
 */
export function formatAmount(smallestUnits: number, numberFormat: string, unitCode?: string): string {
  const scale = scaleFor(unitCode);
  const decimals = decimalPlacesFor(unitCode);
  const negative = smallestUnits < 0;
  const abs = Math.abs(Math.round(smallestUnits));
  const whole = Math.floor(abs / scale).toString();
  const dec = decimals > 0 ? (abs % scale).toString().padStart(decimals, '0') : '';

  let groupSep: string;
  let decimalSep: string;
  switch (numberFormat) {
    case '1,000.00':
      groupSep = ',';
      decimalSep = '.';
      break;
    case '1 000.00':
      groupSep = ' ';
      decimalSep = '.';
      break;
    case '1.000,00':
      groupSep = '.';
      decimalSep = ',';
      break;
    case '1000,00':
      groupSep = '';
      decimalSep = ',';
      break;
    case "1'000.00":
      groupSep = "'";
      decimalSep = '.';
      break;
    case '1000.00':
    default:
      groupSep = '';
      decimalSep = '.';
      break;
  }

  const grouped = groupSep ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, groupSep) : whole;
  const result = decimals > 0 ? `${grouped}${decimalSep}${dec}` : grouped;
  // Standard accounting convention: a negative amount is shown in
  // parentheses, e.g. "(1,234.56)", never a leading minus sign — a
  // real, reported issue, not a style preference. A negative total
  // itself (a net loss, a deficit) can be a real, legitimate figure;
  // this only fixes how it's displayed, not whether it's allowed.
  return negative ? `(${result})` : result;
}

/**
 * Applies the user's own explicit date_format pattern directly to a
 * real ISO date string (YYYY-MM-DD, this app's own storage format).
 * Never Intl.DateTimeFormat locale inference — the same reasoning as
 * formatAmount above. Also takes dateFormat as a required parameter,
 * for the same testability reason.
 */
export function formatDate(isoDate: string | null | undefined, dateFormat: string): string {
  if (!isoDate) return '';
  const [yyyy, mm, dd] = isoDate.slice(0, 10).split('-');
  if (!yyyy || !mm || !dd) return isoDate;

  switch (dateFormat) {
    case 'mm/dd/yyyy':
      return `${mm}/${dd}/${yyyy}`;
    case 'dd.mm.yyyy':
      return `${dd}.${mm}.${yyyy}`;
    case 'dd-mm-yyyy':
      return `${dd}-${mm}-${yyyy}`;
    case 'yyyy-mm-dd':
      return `${yyyy}-${mm}-${dd}`;
    case 'dd/mm/yyyy':
    default:
      return `${dd}/${mm}/${yyyy}`;
  }
}
