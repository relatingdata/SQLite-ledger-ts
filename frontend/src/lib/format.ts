// Number and date display — see docs/pm-frontend-reference.md for the
// full design of each function below.
// See docs/pm-frontend-reference.md.
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// See docs/pm-frontend-reference.md.
const UNIT_SCALE: Record<string, number> = {
  // Zero decimal places (ISO 4217 minor unit = 0).
  BIF: 1, CLF: 10000, DJF: 1, GNF: 1, ISK: 1, JPY: 1, KMF: 1, KRW: 1,
  PYG: 1, RWF: 1, UGX: 1, VND: 1, VUV: 1, XAF: 1, XOF: 1, XPF: 1,
  // Three decimal places (ISO 4217 minor unit = 3).
  BHD: 1000, IQD: 1000, JOD: 1000, KWD: 1000, LYD: 1000, OMR: 1000, TND: 1000,
};

// See docs/pm-frontend-reference.md.
function scaleFor(unitCode: string | undefined): number {
  if (!unitCode) return 100;
  return UNIT_SCALE[unitCode] ?? 100;
}

// See docs/pm-frontend-reference.md.
export function decimalPlacesFor(unitCode: string | undefined): number {
  return Math.round(Math.log10(scaleFor(unitCode)));
}

// See docs/pm-frontend-reference.md.
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
  // Parens for negative, per accounting convention — see docs/pm-frontend-reference.md.
  return negative ? `(${result})` : result;
}

// See docs/pm-frontend-reference.md.
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
