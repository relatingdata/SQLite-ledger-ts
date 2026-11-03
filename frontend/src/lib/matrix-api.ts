import { auth } from '$lib/state.svelte';
import type { ProfitAndLoss } from '$lib/api';

// Self-contained ASCII-CSV call wrapper, deliberately not sharing api.ts's
// internal helper — see docs/pm-frontend-reference.md. Same wire protocol
// as api.ts's own callRaw/callRow/callTable (backend/src/routes/call.ts),
// duplicated locally rather than cross-imported, same reasoning as api.ts
// duplicating shared-fixtures/csv.ts locally: this module has its own
// separate history and is kept self-contained on purpose.

const BASE = 'http://localhost:3001/api';

export class MatrixApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

// Exactly matches shared-fixtures/csv.ts's real escaping (unicode as
// \u{hex}, comma/quote/newline via double-quote quoting) — a prior
// version of this file used a different, incompatible \c/\n backslash
// scheme that happened not to be caught by testing because no value
// exercised here ever contained a comma, quote or non-ASCII character.
function escapeAscii(text: string): string {
  return Array.from(text)
    .map((ch) => {
      const code = ch.codePointAt(0)!;
      return code < 128 ? ch : '\\u{' + code.toString(16) + '}';
    })
    .join('');
}
function unescapeAscii(text: string): string {
  return text.replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}
function csvField(value: string): string {
  const escaped = escapeAscii(value);
  if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) return '"' + escaped.replace(/"/g, '""') + '"';
  return escaped;
}
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else current += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      fields.push(current);
      current = '';
    } else current += ch;
  }
  fields.push(current);
  return fields;
}

async function matrixCallRaw(name: string, values: (string | undefined)[]): Promise<string[][]> {
  const current = auth.current;
  const headers: Record<string, string> = { 'Content-Type': 'text/csv' };
  if (current) headers.Authorization = `Bearer ${current.token}`;
  const line = [name, ...values.map((v) => v ?? '')].map(csvField).join(',');
  let res: Response;
  try {
    res = await fetch(`${BASE}/call`, { method: 'POST', headers, body: line });
  } catch {
    throw new MatrixApiError(0, 'Could not reach the server.');
  }
  const text = await res.text();
  const lines = text.split('\n').filter((l) => l.length > 0);
  const firstFields = splitCsvLine(lines[0] ?? '').map(unescapeAscii);
  if (firstFields[0] === 'error') throw new MatrixApiError(res.status, firstFields[1] ?? `Request failed (${res.status})`);
  return lines.map((l) => splitCsvLine(l).map(unescapeAscii));
}
async function matrixCallTable<T>(name: string, values: (string | undefined)[], parseRow: (fields: Record<string, string>) => T): Promise<T[]> {
  const lines = await matrixCallRaw(name, values);
  if (lines.length < 2) return [];
  const header = lines[1];
  return lines.slice(2).map((fields) => parseRow(Object.fromEntries(header.map((h, i) => [h, fields[i] ?? '']))));
}

// Still-JSON fallback, used only by getProfitAndLossByAxis below, which is
// deliberately not yet converted to the ASCII-CSV protocol (see that
// function's own comment) — its backing route (routes/matrix-reports.ts's
// '/profit-and-loss-by-axis') is the one endpoint in this file not yet
// migrated off the old JSON route.
async function matrixRequestJson<T>(path: string): Promise<T> {
  const current = auth.current;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (current) headers.Authorization = `Bearer ${current.token}`;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { headers });
  } catch {
    throw new MatrixApiError(0, 'Could not reach the server.');
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* non-JSON error body — keep the generic message */
    }
    throw new MatrixApiError(res.status, message);
  }
  return res.json();
}

export type MatrixAxis = 'Item' | 'Category' | 'Location' | 'Consolidated' | (string & {});

export interface MatrixCell {
  rowKey: string;
  colKey: string;
  salesMinor: number;
  cogsMinor: number;
}

export interface SalesCogsMatrix {
  rowAxis: MatrixAxis;
  colAxis: MatrixAxis;
  cells: MatrixCell[];
  totalSalesMinor: number;
  totalCogsMinor: number;
}

export const getSalesCogsMatrix = async (business: string, ledger: string, rowAxis: MatrixAxis, colAxis: MatrixAxis, fromDate?: string, toDate?: string): Promise<SalesCogsMatrix> => {
  const rawRows = await matrixCallTable('getSalesCogsMatrix', [business, ledger, rowAxis, colAxis, fromDate, toDate], (f) => f);
  const totalSalesMinor = rawRows.length > 0 ? Number(rawRows[0].totalSalesMinor) : 0;
  const totalCogsMinor = rawRows.length > 0 ? Number(rawRows[0].totalCogsMinor) : 0;
  const cells = rawRows.filter((f) => f.rowKey !== '' || f.colKey !== '').map((f) => ({ rowKey: f.rowKey, colKey: f.colKey, salesMinor: Number(f.salesMinor), cogsMinor: Number(f.cogsMinor) }));
  return { rowAxis, colAxis, cells, totalSalesMinor, totalCogsMinor };
};

export interface StockOnHandCell {
  rowKey: string;
  colKey: string;
  quantityBottles: number;
  valueAtCostMinor: number;
  lastCostMinor: number | null;
  averageCostMinor: number | null;
  realizableValueMinor: number;
}

export interface StockOnHandMatrix {
  rowAxis: MatrixAxis;
  colAxis: MatrixAxis;
  cells: StockOnHandCell[];
  totalValueAtCostMinor: number;
  totalRealizableValueMinor: number;
}

export const getStockOnHandMatrix = async (rowAxis: MatrixAxis, colAxis: MatrixAxis): Promise<StockOnHandMatrix> => {
  const rawRows = await matrixCallTable('getStockOnHandMatrix', [rowAxis, colAxis], (f) => f);
  const totalValueAtCostMinor = rawRows.length > 0 ? Number(rawRows[0].totalValueAtCostMinor) : 0;
  const totalRealizableValueMinor = rawRows.length > 0 ? Number(rawRows[0].totalRealizableValueMinor) : 0;
  const cells = rawRows
    .filter((f) => f.rowKey !== '' || f.colKey !== '')
    .map((f) => ({
      rowKey: f.rowKey,
      colKey: f.colKey,
      quantityBottles: Number(f.quantityBottles),
      valueAtCostMinor: Number(f.valueAtCostMinor),
      lastCostMinor: f.lastCostMinor === '' ? null : Number(f.lastCostMinor),
      averageCostMinor: f.averageCostMinor === '' ? null : Number(f.averageCostMinor),
      realizableValueMinor: Number(f.realizableValueMinor),
    }));
  return { rowAxis, colAxis, cells, totalValueAtCostMinor, totalRealizableValueMinor };
};

export interface ProfitAndLossByAxisNode {
  key: string;
  profitAndLoss: ProfitAndLoss;
  children: ProfitAndLossByAxisNode[];
}

export const getProfitAndLossByAxis = (
  business: string,
  ledger: string,
  outerAxis: MatrixAxis,
  innerAxis: MatrixAxis,
  fromDate?: string,
  toDate?: string,
  outerFilter?: string,
  innerFilter?: string
) =>
  matrixRequestJson<ProfitAndLossByAxisNode[]>(
    `/reports/matrix/profit-and-loss-by-axis?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}&outerAxis=${outerAxis}&innerAxis=${innerAxis}${fromDate ? `&fromDate=${fromDate}` : ''}${toDate ? `&toDate=${toDate}` : ''}${outerFilter ? `&outerFilter=${encodeURIComponent(outerFilter)}` : ''}${innerFilter ? `&innerFilter=${encodeURIComponent(innerFilter)}` : ''}`
  );

export interface AxisValues {
  Item: string[];
  Category: string[];
  Location: string[];
  [hierarchyName: string]: string[];
}

export const getAxisValues = async (business: string, ledger: string): Promise<AxisValues> => {
  const rawRows = await matrixCallTable('getAxisValues', [business, ledger], (f) => f);
  const result: AxisValues = { Item: [], Category: [], Location: [] };
  for (const { axis, value } of rawRows) {
    if (!(axis in result)) result[axis] = [];
    if (value !== '') result[axis].push(value);
  }
  return result;
};
