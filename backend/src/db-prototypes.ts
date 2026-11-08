// Project Proposal Prototypes — a per-business library of reusable,
// named Recipe-line templates (e.g. "Small Dwelling"/"Medium Dwelling"/
// "Large Dwelling") that a new multi-line Quotation ("Project Proposal",
// db-quotations.ts's addQuotationLine) is instantiated from, and refined
// over time — via the explicit, bounded updatePrototypeLine below, never
// an automatic learning algorithm — as real projects complete. Named
// after, but not implemented with, the engine's own existing product
// prototype/instance vocabulary (defineProductShape/ensureProductInstance,
// db.ts) — same naming spirit only; this reuses Stage 1's BOM mechanism
// verbatim, staged under the prototype's own entity instead of an
// assembly item, exactly as every other Recipe-shaped line list in this
// engagement does. See docs/pm-project-builder.md.
import { Entity } from './primitives.js';
import {
  ValidationError,
  requireEntity,
  create,
  typeRootName,
  typeBusinessName,
  typeBusinessPrototypeRootName,
  typePrototypeName,
  stageBomComponent,
  postBomComponents,
  getBomComponents,
  createQuotation,
  type BomLineKind,
  type BomComponentLine,
  type BusinessName,
  type UserId,
} from './db.js';

function prototypesRoot(business: BusinessName) {
  return requireEntity('Project Proposal Prototypes', typeBusinessPrototypeRootName, requireEntity(business, typeBusinessName, requireEntity('Businesses', typeRootName)));
}

export function createPrototype(name: string, business: BusinessName, userId: UserId): { id: number } {
  const root = prototypesRoot(business);
  if (Entity.getUnder(name, root.id)) throw new ValidationError(`A real Project Proposal Prototype named "${name}" already exists for "${business}".`);
  return create(root, typePrototypeName, name, userId);
}

export function listPrototypes(business: BusinessName): string[] {
  return Entity.children(prototypesRoot(business).id).map((c) => c.name);
}

// Direct call-through to Stage 1's BOM mechanism, staged under the
// prototype's own entity — the same shape db-quotations.ts's
// addQuotationLine uses for a live Quotation, just a reusable template
// instead of a one-off proposal.
export function addPrototypeLine(
  prototypeName: string,
  business: BusinessName,
  kind: BomLineKind,
  resourceOrItemName: string,
  quantity: number,
  unit: string,
  priceMinor: number,
  userId: UserId,
  durationHours?: number,
  scheduledStart?: string
): void {
  stageBomComponent({
    assemblyItem: prototypeName,
    business,
    componentItem: resourceOrItemName,
    quantity,
    unit,
    kind,
    priceMinor,
    durationHours,
    scheduledStart,
  });
  postBomComponents(prototypeName, business, userId);
}

export function getPrototypeLines(prototypeName: string): BomComponentLine[] {
  return getBomComponents(prototypeName);
}

// A bounded, explicit, human-driven re-stage-and-post call — per direct
// instruction, deliberately NOT automatic learning from project
// profitability. Only ever changes the one named line; every other field
// on it (quantity/unit/kind/scheduledStart) carries over unchanged unless
// a new value is given.
export function updatePrototypeLine(
  prototypeName: string,
  business: BusinessName,
  resourceOrItemName: string,
  userId: UserId,
  newDurationHours?: number,
  newPriceMinor?: number
): void {
  const lines = getBomComponents(prototypeName);
  const existing = lines.find((l) => l.component === resourceOrItemName);
  if (!existing) throw new ValidationError(`No real "${resourceOrItemName}" line on prototype "${prototypeName}".`);
  stageBomComponent({
    assemblyItem: prototypeName,
    business,
    componentItem: resourceOrItemName,
    quantity: existing.quantity,
    unit: existing.unit,
    kind: existing.kind,
    durationHours: newDurationHours ?? existing.durationHours,
    priceMinor: newPriceMinor ?? existing.priceMinor,
    scheduledStart: existing.scheduledStart,
  });
  postBomComponents(prototypeName, business, userId);
}

// Creates a brand-new Quotation (a plain, ordinary one — createQuotation,
// unmodified) and copies every one of the prototype's own Recipe lines
// onto it via addQuotationLine's own underlying mechanism (stage/post),
// so the new proposal starts as a faithful copy, free to be edited line
// by line afterward with db-quotations.ts's own addQuotationLine. The
// header item/quantity/price_minor fields are a real, required Item
// (headerItem) representing the overall proposal on the ledger — the
// REAL commitment detail lives in the copied Recipe lines, same split as
// every other multi-line proposal in this engagement.
export function instantiateProjectProposal(
  prototypeName: string,
  reference: string,
  client: string,
  business: BusinessName,
  ledger: string,
  headerItem: string,
  transdate: string,
  userId: UserId,
  targetCompletionDate?: string
): void {
  const lines = getBomComponents(prototypeName);
  if (lines.length === 0) throw new ValidationError(`Prototype "${prototypeName}" has no real Recipe lines to copy.`);
  const quotedTotalMinor = lines.reduce((sum, l) => sum + (l.priceMinor ?? 0), 0);
  createQuotation(
    {
      reference,
      business,
      ledger,
      customer: client,
      item: headerItem,
      quantity: 1,
      price_minor: quotedTotalMinor,
      transdate,
      description: `Instantiated from Project Proposal Prototype "${prototypeName}".`,
      targetCompletionDate,
    },
    userId
  );
  for (const line of lines) {
    stageBomComponent({
      assemblyItem: reference,
      business,
      componentItem: line.component,
      quantity: line.quantity,
      unit: line.unit,
      kind: line.kind,
      durationHours: line.durationHours,
      scheduledStart: line.scheduledStart,
      priceMinor: line.priceMinor,
    });
  }
  postBomComponents(reference, business, userId);
}
