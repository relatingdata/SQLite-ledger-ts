// Project Proposal Prototypes — db-prototypes.ts, new (not converted from
// any old route — this whole mechanism is new this engagement).
import {
  asBusinessName,
  asLedgerName,
  asUserId,
  createPrototype,
  listPrototypes,
  addPrototypeLine,
  getPrototypeLines,
  updatePrototypeLine,
  instantiateProjectProposal,
  ValidationError,
  type BomLineKind,
} from '../db.js';
import { CallError, requireRole, row, table, type BackendCall } from '../call-dispatch.js';

const PROTOTYPE_LINE_HEADER: (keyof import('../db.js').BomComponentLine)[] = ['component', 'quantity', 'unit', 'kind', 'durationHours', 'scheduledStart', 'scheduledEnd', 'priceMinor'];

export const prototypesFunctions: Record<string, BackendCall> = {
  // Positional args: [0] name, [1] business.
  createPrototype: (v, user) => {
    const u = requireRole(user, 'Administrator', 'Bookkeeper');
    const [name, business] = v;
    if (!name || !business) throw new CallError(400, 'name and business are both required.');
    try {
      createPrototype(name, asBusinessName(business), asUserId(u.id));
      return row();
    } catch (e) {
      if (e instanceof ValidationError) throw new CallError(409, e.message);
      throw e;
    }
  },
  // Positional args: [0] business.
  listPrototypes: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [business] = v;
    if (!business) throw new CallError(400, 'business is required.');
    return table(['name'], listPrototypes(asBusinessName(business)).map((name) => ({ name })));
  },
  // Positional args: [0] prototypeName, [1] business, [2] kind
  // ('Material'|'Labour'|'Plant'), [3] resourceOrItemName, [4] quantity,
  // [5] unit, [6] priceMinor, [7] durationHours?, [8] scheduledStart?.
  // Stages then immediately posts, then returns the full, updated line
  // list — same shape as db-quotations.ts's own addQuotationLine entry.
  addPrototypeLine: (v, user) => {
    const u = requireRole(user, 'Administrator', 'Bookkeeper');
    const [prototypeName, business, kindRaw, resourceOrItemName, quantityRaw, unit, priceMinorRaw, durationRaw, scheduledStart] = v;
    if (!prototypeName || !business || !kindRaw || !resourceOrItemName || !quantityRaw || !unit || !priceMinorRaw) {
      throw new CallError(400, 'prototypeName, business, kind, resourceOrItemName, quantity, unit and priceMinor are all required.');
    }
    if (kindRaw !== 'Material' && kindRaw !== 'Labour' && kindRaw !== 'Plant') {
      throw new CallError(400, `kind must be Material, Labour or Plant — got "${kindRaw}".`);
    }
    addPrototypeLine(
      prototypeName,
      asBusinessName(business),
      kindRaw as BomLineKind,
      resourceOrItemName,
      Number(quantityRaw),
      unit,
      Number(priceMinorRaw),
      asUserId(u.id),
      durationRaw ? Number(durationRaw) : undefined,
      scheduledStart || undefined
    );
    return table(
      PROTOTYPE_LINE_HEADER,
      getPrototypeLines(prototypeName).map((l) => ({ ...l, durationHours: l.durationHours ?? '', scheduledStart: l.scheduledStart ?? '', scheduledEnd: l.scheduledEnd ?? '', priceMinor: l.priceMinor ?? '' }))
    );
  },
  // Positional args: [0] prototypeName.
  getPrototypeLines: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [prototypeName] = v;
    if (!prototypeName) throw new CallError(400, 'prototypeName is required.');
    return table(
      PROTOTYPE_LINE_HEADER,
      getPrototypeLines(prototypeName).map((l) => ({ ...l, durationHours: l.durationHours ?? '', scheduledStart: l.scheduledStart ?? '', scheduledEnd: l.scheduledEnd ?? '', priceMinor: l.priceMinor ?? '' }))
    );
  },
  // Positional args: [0] prototypeName, [1] business, [2] resourceOrItemName,
  // [3] newDurationHours?, [4] newPriceMinor?. A bounded, explicit,
  // human-driven revision — never automatic learning from profitability.
  updatePrototypeLine: (v, user) => {
    const u = requireRole(user, 'Administrator', 'Bookkeeper');
    const [prototypeName, business, resourceOrItemName, newDurationRaw, newPriceMinorRaw] = v;
    if (!prototypeName || !business || !resourceOrItemName) throw new CallError(400, 'prototypeName, business and resourceOrItemName are all required.');
    try {
      updatePrototypeLine(
        prototypeName,
        asBusinessName(business),
        resourceOrItemName,
        asUserId(u.id),
        newDurationRaw ? Number(newDurationRaw) : undefined,
        newPriceMinorRaw ? Number(newPriceMinorRaw) : undefined
      );
      return table(
        PROTOTYPE_LINE_HEADER,
        getPrototypeLines(prototypeName).map((l) => ({ ...l, durationHours: l.durationHours ?? '', scheduledStart: l.scheduledStart ?? '', scheduledEnd: l.scheduledEnd ?? '', priceMinor: l.priceMinor ?? '' }))
      );
    } catch (e) {
      if (e instanceof ValidationError) throw new CallError(404, e.message);
      throw e;
    }
  },
  // Positional args: [0] prototypeName, [1] reference, [2] client,
  // [3] business, [4] ledger, [5] headerItem, [6] transdate,
  // [7] targetCompletionDate?.
  instantiateProjectProposal: (v, user) => {
    const u = requireRole(user, 'Administrator', 'Bookkeeper');
    const [prototypeName, reference, client, business, ledger, headerItem, transdate, targetCompletionDate] = v;
    if (!prototypeName || !reference || !client || !business || !ledger || !headerItem || !transdate) {
      throw new CallError(400, 'prototypeName, reference, client, business, ledger, headerItem and transdate are all required.');
    }
    try {
      instantiateProjectProposal(prototypeName, reference, client, asBusinessName(business), asLedgerName(ledger), headerItem, transdate, asUserId(u.id), targetCompletionDate || undefined);
      return row();
    } catch (e) {
      if (e instanceof ValidationError) throw new CallError(409, e.message);
      throw e;
    }
  },
};
