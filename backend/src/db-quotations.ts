// Quotations (AR, to a customer) and RFQs (AP, to a provider) — per
// direct instruction: NO new SQL table, NO detail_json/JSON of any
// kind, NO raw SQL UPDATE statement anywhere in this file, and NO
// so_staging/po_staging/journal_entry_staging involvement at all.
//
// A Quotation/RFQ is, from the moment it is drafted, the exact same
// real mechanism an ordinary recurring journal entry already is
// (createRecurringJournal, db-journal.ts) — dated at its expected
// transdate, which may be in the future, and real reports already
// have zero effect from it until that date falls inside their query
// range. "Accepting" a quote changes nothing about the posted entry;
// it only flips a Status fact, because the commitment already exists.
// "Rejecting"/"expiring" calls the existing, unmodified
// reverseJournalEntry — the same function any other entry already
// uses to undo itself — and separately reverses the quantity posted
// to the item's own existing On Order account. "Circumstances change"
// (different date/quantity/price) is handled the same way: reverse,
// then draft a fresh one. No new logic for any of this — every moving
// part (createRecurringJournal, reverseJournalEntry,
// ensureItemQuantityAccounts, postQuantityMovement) already existed
// before this file.
//
// Every fact a quote needs beyond the real journal entry itself —
// direction, status, business/ledger, counterparty, item, quantity,
// price, location, an optional expiry — is a scalar child entity via
// the existing, generic Entity.setAttr/getAttr primitives
// (primitives.ts). This is the same non-JSON, non-table, non-UPDATE
// mechanism already used throughout this codebase for one labeled
// scalar fact on an entity.
import { db } from './db.js';
import { Entity } from './primitives.js';
import {
  ValidationError,
  NotFoundError,
  createSystemEntity,
  ensureItemQuantityAccounts,
  asItemName,
  asLocationName,
  asBusinessName,
  asLedgerName,
  asAccountName,
  type BusinessName,
  type LedgerName,
  type UserId,
} from './db.js';
import { postQuantityMovement } from './db-stock.js';
import { createRecurringJournal, reverseJournalEntry, type Recurrence } from './db-journal.js';

export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
export type QuotationDirection = 'AR' | 'AP';

export interface QuotationInput {
  reference: string;
  business: string;
  ledger: string;
  // Present for AR (Quotation); absent for AP (RFQ).
  customer?: string;
  // Present for AP (RFQ); absent for AR (Quotation).
  vendor?: string;
  item: string;
  quantity: number;
  price_minor: number;
  location?: string;
  transdate: string;
  description?: string;
}

export interface QuotationRecord {
  reference: string;
  direction: QuotationDirection;
  status: QuotationStatus;
  business: string;
  ledger: string;
  customer?: string;
  vendor?: string;
  item: string;
  quantity: number;
  price_minor: number;
  location?: string | null;
  transdate: string;
  description?: string | null;
  expiryDate?: string | null;
}

const QUOTATIONS_ROOT = 'Quotations and RFQs';

function ensureQuotationsRoot(): { id: number } {
  const applicationId = (db.prepare(`SELECT id FROM current_entities WHERE name = 'Application'`).get() as { id: number } | undefined)?.id;
  if (!applicationId) throw new ValidationError('No real "Application" root — this installation is not fully seeded.');
  const existing = db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = ?`).get(QUOTATIONS_ROOT, applicationId) as { id: number } | undefined;
  if (existing) return existing;
  return { id: createSystemEntity(QUOTATIONS_ROOT, applicationId) };
}

function getQuotationEntityId(reference: string): number | undefined {
  const root = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(QUOTATIONS_ROOT) as { id: number } | undefined;
  if (!root) return undefined;
  return Entity.getUnder(reference, root.id)?.id;
}

// The real journal entry a quote's commitment lives in. reference is
// unique per business/ledger, same guarantee so_staging's PK used to
// give — looked up directly rather than threading a journal id through
// every function, since createRecurringJournal (deliberately
// unmodified) doesn't hand one back.
function findJournal(business: string, ledger: string, reference: string): { id: number; transdate: string } | undefined {
  return db
    .prepare(
      `SELECT j.id AS id, j.transdate AS transdate FROM journal j
       JOIN current_entities b ON b.id = j.business_id AND b.name = ?
       JOIN current_entities l ON l.id = j.ledger_id AND l.name = ?
       WHERE j.reference = ?`
    )
    .get(business, ledger, reference) as { id: number; transdate: string } | undefined;
}

function readQuotation(reference: string): QuotationRecord | undefined {
  const entityId = getQuotationEntityId(reference);
  if (!entityId) return undefined;
  const direction = Entity.getAttr(entityId, 'Direction') as QuotationDirection | undefined;
  const status = Entity.getAttr(entityId, 'Status') as QuotationStatus | undefined;
  const business = Entity.getAttr(entityId, 'Business');
  const ledger = Entity.getAttr(entityId, 'Ledger');
  const item = Entity.getAttr(entityId, 'Item');
  const quantityRaw = Entity.getAttr(entityId, 'Quantity');
  const priceRaw = Entity.getAttr(entityId, 'Price Minor');
  const transdate = Entity.getAttr(entityId, 'Transdate');
  if (!direction || !status || !business || !ledger || !item || !quantityRaw || !priceRaw || !transdate) return undefined;
  const counterparty = Entity.getAttr(entityId, 'Counterparty');
  const location = Entity.getAttr(entityId, 'Location') ?? null;
  const description = Entity.getAttr(entityId, 'Description') ?? null;
  const expiryDate = Entity.getAttr(entityId, 'Expiry Date') ?? null;

  return {
    reference,
    direction,
    status,
    business,
    ledger,
    customer: direction === 'AR' ? counterparty : undefined,
    vendor: direction === 'AP' ? counterparty : undefined,
    item,
    quantity: Number(quantityRaw),
    price_minor: Number(priceRaw),
    location,
    transdate,
    description,
    expiryDate,
  };
}

function draftQuotation(
  direction: QuotationDirection,
  input: QuotationInput,
  userId: UserId,
  expiryDate: string | null | undefined,
  recurrence: Recurrence,
  recurrenceCount: number | undefined
): void {
  const counterparty = direction === 'AR' ? input.customer : input.vendor;
  if (!counterparty) throw new ValidationError(direction === 'AR' ? 'A Quotation needs a customer.' : 'An RFQ needs a vendor.');

  const amount = input.quantity * input.price_minor;
  const lines =
    direction === 'AR'
      ? [
          { account: counterparty, amount_minor: amount },
          { account: 'Sales Revenue', amount_minor: -amount },
        ]
      : [
          { account: input.item, amount_minor: amount },
          { account: counterparty, amount_minor: -amount },
        ];
  createRecurringJournal(
    asBusinessName(input.business),
    asLedgerName(input.ledger),
    input.reference,
    input.transdate,
    recurrence,
    lines,
    userId,
    input.description,
    recurrenceCount
  );

  const { onOrderAccount, onOrderAccountId } = ensureItemQuantityAccounts(asItemName(input.item), userId);
  postQuantityMovement(
    asBusinessName(input.business),
    asLedgerName(input.ledger),
    `${input.reference}-ONORDER`,
    asAccountName(onOrderAccount),
    direction === 'AR' ? -input.quantity : input.quantity,
    userId,
    input.transdate,
    input.location ? asLocationName(input.location) : undefined,
    onOrderAccountId
  );

  const root = ensureQuotationsRoot();
  const entity = Entity.getUnder(input.reference, root.id) ?? Entity.create(input.reference, root.id, userId);
  Entity.setAttr(entity.id, 'Direction', direction, userId);
  Entity.setAttr(entity.id, 'Status', 'draft', userId);
  Entity.setAttr(entity.id, 'Business', input.business, userId);
  Entity.setAttr(entity.id, 'Ledger', input.ledger, userId);
  Entity.setAttr(entity.id, 'Counterparty', counterparty, userId);
  Entity.setAttr(entity.id, 'Item', input.item, userId);
  Entity.setAttr(entity.id, 'Quantity', String(input.quantity), userId);
  Entity.setAttr(entity.id, 'Price Minor', String(input.price_minor), userId);
  Entity.setAttr(entity.id, 'Transdate', input.transdate, userId);
  if (input.location) Entity.setAttr(entity.id, 'Location', input.location, userId);
  if (input.description) Entity.setAttr(entity.id, 'Description', input.description, userId);
  if (expiryDate) Entity.setAttr(entity.id, 'Expiry Date', expiryDate, userId);
}

export function createQuotation(
  input: QuotationInput,
  userId: UserId,
  expiryDate?: string | null,
  recurrence: Recurrence = 'once',
  recurrenceCount?: number
): void {
  draftQuotation('AR', input, userId, expiryDate, recurrence, recurrenceCount);
}

export function createRfq(
  input: QuotationInput,
  userId: UserId,
  expiryDate?: string | null,
  recurrence: Recurrence = 'once',
  recurrenceCount?: number
): void {
  draftQuotation('AP', input, userId, expiryDate, recurrence, recurrenceCount);
}

export function getQuotation(reference: string): QuotationRecord | undefined {
  return readQuotation(reference);
}

export function listQuotations(business: BusinessName, ledger: LedgerName, direction?: QuotationDirection): QuotationRecord[] {
  const root = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(QUOTATIONS_ROOT) as { id: number } | undefined;
  if (!root) return [];
  const rows = db.prepare(`SELECT name AS reference FROM current_entities WHERE parent_id = ?`).all(root.id) as { reference: string }[];
  return rows
    .map((r) => readQuotation(r.reference))
    .filter((q): q is QuotationRecord => !!q && q.business === business && q.ledger === ledger && (!direction || q.direction === direction))
    .sort((a, b) => (b.transdate ?? '').localeCompare(a.transdate ?? ''));
}

// A pure status marker (the quote has gone to the customer/provider,
// nothing posted changes) — kept distinct from draft so a UI can show
// "awaiting response" vs "not yet sent".
export function markQuotationSent(reference: string, userId: UserId): void {
  const entityId = getQuotationEntityId(reference);
  if (!entityId) throw new NotFoundError(`No real quotation/RFQ named "${reference}".`);
  Entity.setAttr(entityId, 'Status', 'sent', userId);
}

// Accepting is a pure status flip — the real commitment (the journal
// entry and the On Order quantity posting) was created back at draft
// time, so there is no separate "convert to order" posting step left
// to perform.
export function acceptQuotation(reference: string, userId: UserId): void {
  const quotation = readQuotation(reference);
  if (!quotation) throw new NotFoundError(`No real quotation/RFQ named "${reference}".`);
  if (quotation.status === 'accepted') throw new ValidationError(`"${reference}" has already been accepted.`);
  if (quotation.status === 'rejected' || quotation.status === 'expired') throw new ValidationError(`"${reference}" is ${quotation.status} and can no longer be accepted.`);
  const entityId = getQuotationEntityId(reference)!;
  Entity.setAttr(entityId, 'Status', 'accepted', userId);
}

// Rejecting/expiring reverses the real commitment: the journal entry
// via the existing reverseJournalEntry, and the quantity already
// posted to the item's On Order account via an equal, opposite
// postQuantityMovement — both pre-existing mechanisms, used exactly as
// they already are everywhere else.
export function rejectQuotation(reference: string, userId: UserId, asOfDate?: string): void {
  const quotation = readQuotation(reference);
  if (!quotation) throw new NotFoundError(`No real quotation/RFQ named "${reference}".`);
  if (quotation.status === 'accepted') throw new ValidationError(`"${reference}" has already been accepted — it can no longer be rejected.`);
  if (quotation.status === 'rejected' || quotation.status === 'expired') throw new ValidationError(`"${reference}" is already ${quotation.status}.`);

  const journal = findJournal(quotation.business, quotation.ledger, reference);
  if (journal) {
    reverseJournalEntry(asBusinessName(quotation.business), asLedgerName(quotation.ledger), journal.id, journal.transdate, userId, asOfDate);
  }
  const { onOrderAccount, onOrderAccountId } = ensureItemQuantityAccounts(asItemName(quotation.item), userId);
  postQuantityMovement(
    asBusinessName(quotation.business),
    asLedgerName(quotation.ledger),
    `${reference}-ONORDER-REV`,
    asAccountName(onOrderAccount),
    quotation.direction === 'AR' ? quotation.quantity : -quotation.quantity,
    userId,
    asOfDate ?? quotation.transdate,
    undefined,
    onOrderAccountId
  );

  const entityId = getQuotationEntityId(reference)!;
  Entity.setAttr(entityId, 'Status', 'rejected', userId);
}
