import { auth } from '$lib/state.svelte';
import type { ProfitAndLoss } from '$lib/api';

// A real, small, deliberately self-contained fetch wrapper — per
// direct instruction to touch no existing code at all, this
// duplicates (rather than imports/exports) the same, simple pattern
// $lib/api.ts already uses internally, since that helper isn't
// itself exported and this file must not modify that one at all.

const BASE = 'http://localhost:3001/api';

export class MatrixApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

async function matrixRequest<T>(path: string): Promise<T> {
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

export type MatrixAxis = 'Product' | 'Category' | 'Location' | 'Division' | 'Consolidated';

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

export const getSalesCogsMatrix = (business: string, ledger: string, rowAxis: MatrixAxis, colAxis: MatrixAxis, fromDate?: string, toDate?: string) =>
  matrixRequest<SalesCogsMatrix>(
    `/reports/matrix/sales-cogs-matrix?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}&rowAxis=${rowAxis}&colAxis=${colAxis}${fromDate ? `&fromDate=${fromDate}` : ''}${toDate ? `&toDate=${toDate}` : ''}`
  );

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

export const getStockOnHandMatrix = (rowAxis: MatrixAxis, colAxis: MatrixAxis) =>
  matrixRequest<StockOnHandMatrix>(`/reports/matrix/stock-on-hand-matrix?rowAxis=${rowAxis}&colAxis=${colAxis}`);

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
  matrixRequest<ProfitAndLossByAxisNode[]>(
    `/reports/matrix/profit-and-loss-by-axis?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}&outerAxis=${outerAxis}&innerAxis=${innerAxis}${fromDate ? `&fromDate=${fromDate}` : ''}${toDate ? `&toDate=${toDate}` : ''}${outerFilter ? `&outerFilter=${encodeURIComponent(outerFilter)}` : ''}${innerFilter ? `&innerFilter=${encodeURIComponent(innerFilter)}` : ''}`
  );

export interface AxisValues {
  Product: string[];
  Category: string[];
  Location: string[];
  Division: string[];
}

export const getAxisValues = (business: string, ledger: string) =>
  matrixRequest<AxisValues>(`/reports/matrix/axis-values?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}`);
