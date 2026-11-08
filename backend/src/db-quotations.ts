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
  stageBomComponent,
  postBomComponents,
  getBomComponents,
  type BomLineKind,
  type BomComponentLine,
  type BusinessName,
  type LedgerName,
  type UserId,
} from './db.js';
import { postQuantityMovement } from './db-stock.js';
import { createRecurringJournal, reverseJournalEntry, type Recurrence } from './db-journal.js';
// Stage 4 (Recipe/Project Builder work): accepting a multi-line Project
// Proposal creates the real Live Project + Milestones and schedules its
// Labour/Plant lines — db-projects.ts, imported directly (not via db.ts's
// own barrel re-export) to keep the dependency direction one-way.
import { createLiveProject, createMilestone, scheduleProjectRecipeLines, checkMilestoneAchievability, provisionProjectProfitCenter } from './db-projects.js';

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
  // Additive, Stage-4 widening: the client's own wanted completion date for
  // a multi-line Project Proposal. Ignored (and never written) by any
  // plain, line-less Quotation/RFQ — every pre-existing caller (Retail
  // included) is unaffected.
  targetCompletionDate?: string;
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
  targetCompletionDate?: string | null;
}

const QUOTATIONS_ROOT = 'Quotations and RFQs';

function ensureQuotationsRoot(): { id: number } {
  const applicationId = Entity.get('Application')?.id;
  if (!applicationId) throw new ValidationError('No real "Application" root — this installation is not fully seeded.');
  const existing = Entity.getUnder(QUOTATIONS_ROOT, applicationId);
  if (existing) return existing;
  return { id: createSystemEntity(QUOTATIONS_ROOT, applicationId) };
}

function getQuotationEntityId(reference: string): number | undefined {
  const root = Entity.get(QUOTATIONS_ROOT);
  if (!root) return undefined;
  return Entity.getUnder(reference, root.id)?.id;
}

// The real journal entry a quote's commitment lives in. reference is
// unique per business/ledger, same guarantee so_staging's PK used to
// give — looked up directly rather than threading a journal id through
// every function, since createRecurringJournal (deliberately
// unmodified) doesn't hand one back. Business/ledger names are resolved
// to ids via Entity.get first (the one seam that knows how "entities"
// are actually stored); the journal table itself is never an entity, so
// the SQL against it stays plain, id-only SQL.
function findJournal(business: string, ledger: string, reference: string): { id: number; transdate: string } | undefined {
  const businessId = Entity.get(business)?.id;
  const ledgerId = Entity.get(ledger)?.id;
  if (businessId === undefined || ledgerId === undefined) return undefined;
  return db.prepare(`SELECT id, transdate FROM journal WHERE business_id = ? AND ledger_id = ? AND reference = ?`).get(businessId, ledgerId, reference) as
    | { id: number; transdate: string }
    | undefined;
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
  const targetCompletionDate = Entity.getAttr(entityId, 'Target Completion Date') ?? null;

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
    targetCompletionDate,
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
  if (input.targetCompletionDate) Entity.setAttr(entity.id, 'Target Completion Date', input.targetCompletionDate, userId);
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
  const root = Entity.get(QUOTATIONS_ROOT);
  if (!root) return [];
  const rows = Entity.children(root.id);
  return rows
    .map((r) => readQuotation(r.name))
    .filter((q): q is QuotationRecord => !!q && q.business === business && q.ledger === ledger && (!direction || q.direction === direction))
    .sort((a, b) => (b.transdate ?? '').localeCompare(a.transdate ?? ''));
}

// Attaches one real Recipe-shaped child line directly under the
// Quotation's OWN existing entity (already resolvable via Entity.get,
// since draftQuotation already hangs its scalar attrs off that same
// node) — a direct call-through to the existing, unmodified Stage-1 BOM
// mechanism (stageBomComponent/postBomComponents), parameterized by the
// quotation's own reference instead of an assembly item. This is the
// ONLY way to widen Quotation with real, multi-line detail without
// violating this file's own stated "no new SQL table/JSON" constraint —
// reusing Stage 1's mechanism verbatim, not inventing a second one. A
// plain, line-less Quotation/RFQ (Retail included) never calls this, so
// it is unaffected.
export function addQuotationLine(
  reference: string,
  kind: BomLineKind,
  resourceOrItemName: string,
  quantity: number,
  unit: string,
  priceMinor: number,
  userId: UserId,
  durationHours?: number,
  scheduledStart?: string
): void {
  const quotation = readQuotation(reference);
  if (!quotation) throw new NotFoundError(`No real quotation/RFQ named "${reference}".`);
  stageBomComponent({
    assemblyItem: reference,
    business: quotation.business,
    componentItem: resourceOrItemName,
    quantity,
    unit,
    kind,
    priceMinor,
    durationHours,
    scheduledStart,
  });
  postBomComponents(reference, quotation.business, userId);
}

export function getQuotationLines(reference: string): BomComponentLine[] {
  return getBomComponents(reference);
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
// to perform. ADDITIVELY (Stage 4): when this Quotation carries real
// Recipe lines (addQuotationLine, above) — i.e. it is a Project Proposal,
// not a plain quote — and the caller opts in with `projectDetails`, this
// also creates the real Live Project + an Invoicing Milestone
// (db-projects.ts, Stage 3) and copies every line onto the Project under
// ITS OWN name (deliberately NOT the quotation's own reference — a Live
// Project and its originating Quotation coexist as two separate,
// same-business entities, and reusing one bare name for both would be
// exactly the kind of unscoped-resolution collision db.ts's own
// typeBusinessLiveProjectsRootName comment already warns about), then
// runs scheduleProjectRecipeLines/checkMilestoneAchievability for its
// real, as-accepted schedule. A plain, line-less Quotation/RFQ (Retail
// included), or any caller that omits `projectDetails`, triggers none of
// this — purely the original status flip.
export function acceptQuotation(
  reference: string,
  userId: UserId,
  projectDetails?: { projectName: string; targetCompletionDate: string }
): void {
  const quotation = readQuotation(reference);
  if (!quotation) throw new NotFoundError(`No real quotation/RFQ named "${reference}".`);
  if (quotation.status === 'accepted') throw new ValidationError(`"${reference}" has already been accepted.`);
  if (quotation.status === 'rejected' || quotation.status === 'expired') throw new ValidationError(`"${reference}" is ${quotation.status} and can no longer be accepted.`);
  const entityId = getQuotationEntityId(reference)!;
  Entity.setAttr(entityId, 'Status', 'accepted', userId);

  const lines = getBomComponents(reference);
  if (lines.length > 0 && projectDetails) {
    const client = quotation.customer ?? quotation.vendor ?? 'Unknown Client';
    const business = asBusinessName(quotation.business);
    createLiveProject(projectDetails.projectName, business, client, quotation.transdate, projectDetails.targetCompletionDate, userId);
    createMilestone(projectDetails.projectName, 'Invoicing', projectDetails.targetCompletionDate, userId);
    // Stage 5: one dedicated real Profit Center + Expense account per
    // accepted Project Proposal, so every real labour/plant clock-in/out
    // against this project lands as a real, isolated cost, comparable to
    // the quoted price above.
    provisionProjectProfitCenter(projectDetails.projectName, business, userId);
    for (const line of lines) {
      stageBomComponent({
        assemblyItem: projectDetails.projectName,
        business: quotation.business,
        componentItem: line.component,
        quantity: line.quantity,
        unit: line.unit,
        kind: line.kind,
        durationHours: line.durationHours,
        scheduledStart: line.scheduledStart,
        priceMinor: line.priceMinor,
      });
    }
    postBomComponents(projectDetails.projectName, quotation.business, userId);
    scheduleProjectRecipeLines(projectDetails.projectName, business, userId);
    checkMilestoneAchievability(projectDetails.projectName, userId);
  }
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
