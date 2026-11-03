// Converted from routes/matrix-reports.ts. Mounted (old route) with plain
// requireAuth, no specific role — replicated here as requireAuth only.
//
// getProfitAndLossByAxis is DELIBERATELY NOT converted yet: its real
// result (ProfitAndLossByAxisNode[]) nests a full ProfitAndLoss per node
// (income/expenses/cogs_expenses/operating_expenses as flat StatementLine[]
// lists PLUS three arbitrary-depth CategoryTreeNode[] trees), repeated once
// per outer node and once per inner child. Flattening an arbitrary-depth
// tree to CSV needs a general depth/parent-path encoding that the plain,
// non-axis getProfitAndLoss/getBalanceSheet (reports.ts, task #235) will
// need too — designing it once, for both, when reports.ts is converted,
// rather than inventing a one-off here that reports.ts would then have to
// either duplicate or redo. Its old JSON route stays mounted and working
// until that design exists. See the plan file for this note.
import { getSalesCogsMatrix, getStockOnHandMatrix, getAxisValues, type MatrixAxis } from '../db-matrix-reports.js';
import { asBusinessName, asLedgerName } from '../db.js';
import { CallError, requireAuth, table, type BackendCall } from '../call-dispatch.js';

export const matrixReportsFunctions: Record<string, BackendCall> = {
  // Positional args: [0] business, [1] ledger, [2] rowAxis, [3] colAxis, [4] fromDate, [5] toDate.
  // Table columns: rowKey,colKey,salesMinor,cogsMinor,totalSalesMinor,totalCogsMinor
  // (totals denormalized onto every row — read from any row). Zero cells ->
  // one sentinel row with rowKey='',colKey='' (resolveKey never returns
  // an empty string for a real key) carrying totals (always 0 then).
  getSalesCogsMatrix: (v, user) => {
    requireAuth(user);
    const [business, ledger, rowAxis, colAxis, fromDate, toDate] = v;
    if (!business || !ledger || !rowAxis || !colAxis) throw new CallError(400, 'business, ledger, rowAxis and colAxis are all required.');
    const m = getSalesCogsMatrix(asBusinessName(business), asLedgerName(ledger), fromDate || undefined, toDate || undefined, rowAxis as MatrixAxis, colAxis as MatrixAxis);
    const cells =
      m.cells.length > 0
        ? m.cells.map((c) => ({ rowKey: c.rowKey, colKey: c.colKey, salesMinor: c.salesMinor, cogsMinor: c.cogsMinor, totalSalesMinor: m.totalSalesMinor, totalCogsMinor: m.totalCogsMinor }))
        : [{ rowKey: '', colKey: '', salesMinor: 0, cogsMinor: 0, totalSalesMinor: m.totalSalesMinor, totalCogsMinor: m.totalCogsMinor }];
    return table(['rowKey', 'colKey', 'salesMinor', 'cogsMinor', 'totalSalesMinor', 'totalCogsMinor'], cells);
  },
  // Positional args: [0] rowAxis, [1] colAxis.
  // Table columns: rowKey,colKey,quantityBottles,valueAtCostMinor,lastCostMinor,
  // averageCostMinor,realizableValueMinor,totalValueAtCostMinor,totalRealizableValueMinor
  // (totals denormalized, same sentinel-row convention as above).
  getStockOnHandMatrix: (v, user) => {
    requireAuth(user);
    const [rowAxis, colAxis] = v;
    if (!rowAxis || !colAxis) throw new CallError(400, 'rowAxis and colAxis are both required.');
    const m = getStockOnHandMatrix(rowAxis as MatrixAxis, colAxis as MatrixAxis);
    const cells =
      m.cells.length > 0
        ? m.cells.map((c) => ({ ...c, totalValueAtCostMinor: m.totalValueAtCostMinor, totalRealizableValueMinor: m.totalRealizableValueMinor }))
        : [
            {
              rowKey: '',
              colKey: '',
              quantityBottles: 0,
              valueAtCostMinor: 0,
              lastCostMinor: null,
              averageCostMinor: null,
              realizableValueMinor: 0,
              totalValueAtCostMinor: m.totalValueAtCostMinor,
              totalRealizableValueMinor: m.totalRealizableValueMinor,
            },
          ];
    return table(
      ['rowKey', 'colKey', 'quantityBottles', 'valueAtCostMinor', 'lastCostMinor', 'averageCostMinor', 'realizableValueMinor', 'totalValueAtCostMinor', 'totalRealizableValueMinor'],
      cells
    );
  },
  // Positional args: [0] business, [1] ledger.
  // Table columns: axis,value — one row per (axis, value) pair. An axis
  // with zero real values (a business hierarchy nobody has used yet) still
  // needs to survive the round trip as a known axis name (the frontend
  // reads Object.keys(axisValues) to offer it as pivotable) - carried as
  // one row with value='' (resolveKey's real values are never the empty
  // string, confirmed in db-matrix-reports.ts, so this sentinel is safe).
  getAxisValues: (v, user) => {
    requireAuth(user);
    const [business, ledger] = v;
    if (!business || !ledger) throw new CallError(400, 'business and ledger are both required.');
    const axisValues = getAxisValues(asBusinessName(business), asLedgerName(ledger));
    const rows: { axis: string; value: string }[] = [];
    for (const [axis, values] of Object.entries(axisValues)) {
      if (values.length === 0) rows.push({ axis, value: '' });
      else for (const value of values) rows.push({ axis, value });
    }
    return table(['axis', 'value'], rows);
  },
};
