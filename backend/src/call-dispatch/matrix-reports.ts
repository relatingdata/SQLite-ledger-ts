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
import { getStockOnHandMatrix, getAxisValues, getProfitAndLossByAxis, getCube, parseCubeMeasure, type MatrixAxis, type ProfitAndLossByAxisNode } from '../db-matrix-reports.js';
import { asBusinessName, asLedgerName } from '../db.js';
import { CallError, encodeStringList, requireAuth, row, table, type BackendCall } from '../call-dispatch.js';
import { encodeProfitAndLoss } from './reports.js';

function encodeProfitAndLossByAxis(nodes: ProfitAndLossByAxisNode[]): string {
  return encodeStringList(nodes.map((n) => encodeStringList([n.key, encodeProfitAndLoss(n.profitAndLoss), encodeProfitAndLossByAxis(n.children)])));
}

export const matrixReportsFunctions: Record<string, BackendCall> = {
  // The general report cube. Positional args: [0] business, [1] ledger,
  // [2] rowAxis, [3] colAxis, [4] fromDate, [5] toDate, then one measure per
  // further argument (name=postings:-Root|Root, name=onHand,
  // name=onHandAt:cost|retail). Table columns: rowKey,colKey,measure,value,
  // one row per cell per measure.
  getCube: (v, user) => {
    requireAuth(user);
    const [business, ledger, rowAxis, colAxis, fromDate, toDate, ...measureTexts] = v;
    if (!business || !ledger || !rowAxis || !colAxis) throw new CallError(400, 'business, ledger, rowAxis and colAxis are all required.');
    let measures;
    try {
      measures = measureTexts.filter((m) => m).map(parseCubeMeasure);
    } catch (e) {
      throw new CallError(400, (e as Error).message);
    }
    if (measures.length === 0) throw new CallError(400, 'At least one measure is required.');
    const cells = getCube(asBusinessName(business), asLedgerName(ledger), rowAxis as MatrixAxis, colAxis as MatrixAxis, measures, fromDate || undefined, toDate || undefined);
    return table(
      ['rowKey', 'colKey', 'measure', 'value'],
      cells.flatMap((c) => Object.entries(c.values).map(([measure, value]) => ({ rowKey: c.rowKey, colKey: c.colKey, measure, value })))
    );
  },
  // Positional args: [0] rowAxis, [1] colAxis.
  // Table columns: rowKey,colKey,quantityBottles,valueAtCostMinor,lastCostMinor,
  // averageCostMinor,realizableValueMinor,totalValueAtCostMinor,totalRealizableValueMinor
  // (totals denormalized onto every row; with no cells, one row with empty
  // rowKey and colKey carries the totals).
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
    // A third column, group, says which side an axis is on (item or
    // location; empty for an application grouping with no values here).
    const groups: Record<string, string> = { Item: 'item', Location: 'location' };
    const axisValues = getAxisValues(asBusinessName(business), asLedgerName(ledger), groups as never);
    const rows: { axis: string; value: string; group: string }[] = [];
    for (const [axis, values] of Object.entries(axisValues)) {
      const group = groups[axis] ?? '';
      if (values.length === 0) rows.push({ axis, value: '', group });
      else for (const value of values) rows.push({ axis, value, group });
    }
    return table(['axis', 'value', 'group'], rows);
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
