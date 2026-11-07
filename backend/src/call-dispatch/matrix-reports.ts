// Converted from routes/matrix-reports.ts. Mounted (old route) with plain
// requireAuth, no specific role — replicated here as requireAuth only.
//
// getProfitAndLossByAxis was the one endpoint left unconverted in this
// file, deliberately deferred until reports.ts (task #235) designed a
// general arbitrary-depth tree encoding (its own ProfitAndLossByGroupNode
// tree needed exactly the same shape: a full ProfitAndLoss, itself three
// arbitrary-depth CategoryTreeNode[] trees, repeated at every node of a
// further, outer tree). That design now exists — encodeProfitAndLoss,
// exported from reports.ts — so this reuses it directly rather than
// re-deriving it, applying the same recursive-reuse principle
// encodeProfitAndLossByGroupTree itself used: ProfitAndLossByAxisNode has
// the identical {label, profitAndLoss, children} shape (key instead of
// group, and always a real string, never null) and only one level deep in
// practice (getProfitAndLossByAxis never gives grandchildren a non-empty
// children array), but the encoder below is written genuinely recursively
// anyway, matching the real, declared ProfitAndLossByAxisNode type rather
// than assuming today's one-level-deep behavior.
import { getSalesCogsMatrix, getStockOnHandMatrix, getAxisValues, getProfitAndLossByAxis, type MatrixAxis, type ProfitAndLossByAxisNode } from '../db-matrix-reports.js';
import { asBusinessName, asLedgerName } from '../db.js';
import { CallError, encodeStringList, requireAuth, row, table, type BackendCall } from '../call-dispatch.js';
import { encodeProfitAndLoss } from './reports.js';

function encodeProfitAndLossByAxis(nodes: ProfitAndLossByAxisNode[]): string {
  return encodeStringList(nodes.map((n) => encodeStringList([n.key, encodeProfitAndLoss(n.profitAndLoss), encodeProfitAndLossByAxis(n.children)])));
}

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

  // Positional args: [0] business, [1] ledger, [2] outerAxis, [3] innerAxis,
  // [4] fromDate, [5] toDate, [6] outerFilter, [7] innerFilter. A single
  // row, field 0 the whole encoded node tree — same "whole tree in one
  // field" shape as reports.ts's getProfitAndLossByHierarchyTree, reusing
  // its own encodeProfitAndLoss building block.
  getProfitAndLossByAxis: (v, user) => {
    requireAuth(user);
    const [business, ledger, outerAxis, innerAxis, fromDate, toDate, outerFilter, innerFilter] = v;
    if (!business || !ledger) throw new CallError(400, 'business and ledger are both required.');
    if (!outerAxis || !innerAxis) throw new CallError(400, 'outerAxis and innerAxis are both required.');
    const nodes = getProfitAndLossByAxis(
      asBusinessName(business),
      asLedgerName(ledger),
      fromDate || undefined,
      toDate || undefined,
      outerAxis as MatrixAxis,
      innerAxis as MatrixAxis,
      outerFilter || undefined,
      innerFilter || undefined
    );
    return row(encodeProfitAndLossByAxis(nodes));
  },
};
