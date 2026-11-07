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

async function matrixCallRow(name: string, values: (string | undefined)[]): Promise<string[]> {
  const lines = await matrixCallRaw(name, values);
  return lines[0].slice(1);
}

// Matches call-dispatch/reports.ts's own encodeRecordList/decodeRecordList
// — a nested array of records, encoded by reusing the same CSV codec one
// level deeper.
function decodeRecordList(fields: string[], encoded: string): Record<string, string>[] {
  return decodeStringList(encoded).map((lineEncoded) => {
    const values = decodeStringList(lineEncoded);
    return Object.fromEntries(fields.map((f, i) => [f, values[i] ?? '']));
  });
}
function decodeStringList(encoded: string): string[] {
  if (encoded === '') return [];
  return splitCsvLine(encoded).map(unescapeAscii);
}

const STATEMENT_LINE_FIELDS = ['name', 'accountnumber', 'debit_minor', 'credit_minor', 'is_contra'];
interface AccountStatementLine {
  name: string;
  accountnumber: string | null;
  debit_minor: number;
  credit_minor: number;
  is_contra: boolean;
}
function decodeStatementLines(encoded: string): AccountStatementLine[] {
  return decodeRecordList(STATEMENT_LINE_FIELDS, encoded).map((r) => ({
    name: r.name,
    accountnumber: r.accountnumber || null,
    debit_minor: Number(r.debit_minor),
    credit_minor: Number(r.credit_minor),
    is_contra: r.is_contra === 'true',
  }));
}

interface CategoryTreeNode {
  name: string;
  accountnumber: string | null;
  is_leaf: boolean;
  debit_minor: number;
  credit_minor: number;
  is_contra: boolean;
  children: CategoryTreeNode[];
}
// Matches call-dispatch.ts's own encodeCategoryTree/decodeCategoryTree —
// a genuine, arbitrary-depth recursive tree, decoded by calling itself
// again on each node's own encoded children. Duplicated here rather than
// cross-imported from api.ts, same reasoning as this file's own CSV codec
// (see this file's header comment): this module stays self-contained.
function decodeCategoryTree(encoded: string): CategoryTreeNode[] {
  return decodeStringList(encoded).map((lineEncoded) => {
    const f = decodeStringList(lineEncoded);
    return { name: f[0], accountnumber: f[1] || null, is_leaf: f[2] === 'true', debit_minor: Number(f[3]), credit_minor: Number(f[4]), is_contra: f[5] === 'true', children: decodeCategoryTree(f[6]) };
  });
}

// Matches call-dispatch/reports.ts's own encodeProfitAndLoss exactly — the
// same ProfitAndLoss shape imported (as a type only) from api.ts, decoded
// locally for the same self-contained-module reason as everything else in
// this file.
function decodeProfitAndLoss(encoded: string): ProfitAndLoss {
  const f = decodeStringList(encoded);
  return {
    income: decodeStatementLines(f[0]),
    expenses: decodeStatementLines(f[1]),
    cogs_expenses: decodeStatementLines(f[2]),
    operating_expenses: decodeStatementLines(f[3]),
    income_tree: decodeCategoryTree(f[4]),
    cogs_tree: decodeCategoryTree(f[5]),
    operating_expenses_tree: decodeCategoryTree(f[6]),
    total_income_minor: Number(f[7]),
    total_expenses_minor: Number(f[8]),
    gross_profit_minor: Number(f[9]),
    net_income_minor: Number(f[10]),
  };
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
// Matches call-dispatch/matrix-reports.ts's own encodeProfitAndLossByAxis —
// the same self-recursive technique as decodeCategoryTree above, applied
// to a tree whose every node also carries a full ProfitAndLoss.
function decodeProfitAndLossByAxis(encoded: string): ProfitAndLossByAxisNode[] {
  return decodeStringList(encoded).map((lineEncoded) => {
    const f = decodeStringList(lineEncoded);
    return { key: f[0], profitAndLoss: decodeProfitAndLoss(f[1]), children: decodeProfitAndLossByAxis(f[2]) };
  });
}

export const getProfitAndLossByAxis = async (
  business: string,
  ledger: string,
  outerAxis: MatrixAxis,
  innerAxis: MatrixAxis,
  fromDate?: string,
  toDate?: string,
  outerFilter?: string,
  innerFilter?: string
): Promise<ProfitAndLossByAxisNode[]> => {
  const fields = await matrixCallRow('getProfitAndLossByAxis', [business, ledger, outerAxis, innerAxis, fromDate, toDate, outerFilter, innerFilter]);
  return decodeProfitAndLossByAxis(fields[0]);
};

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
