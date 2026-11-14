// The full documentation for every function in this file lives in
// docs/pm-journal-api.md — this file carries no further multiline comments.

import { db } from './db.js';
import { Entity } from './primitives.js';
import {
  ValidationError,
  NotFoundError,
  asUserId,
  asBusinessName,
  asLedgerName,
  asAccountName,
  asProviderName,
  asItemName,
  asLocationName,
  getContact,
  setHierarchyParent,
  setRelationship,
  recordInvoiceLine,
  createLocation,
  setLocation,
  ensureLocationCapacityAccount,
  getActiveLedger,
  resolveBusinessCoaAccountId,
  getPlantItem,
  type Location as StockLocation,
  type BusinessName,
  type LedgerName,
  type TypedNode,
  type AccountName,
  type ProviderName,
  type CustomerName,
  type EmployeeName,
  type UserId,
} from './db.js';
import { postQuantityMovement, placeOrder, fulfillOrder } from './db-stock.js';

export interface StagedLine {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  description?: string;
  transdate?: string;
  account: AccountName;
  accountId?: number;
  amount_minor: number;
  memo?: string;
  bankReference?: string;
}

function findLedgerScopedAccount(ledger: LedgerName, accountName: string): number | undefined {
  const coaLeaf = Entity.get(accountName);
  if (!coaLeaf) return undefined;
  return Entity.getUnder(ledger, coaLeaf.id)?.id;
}

// The one place this file resolves a business name to its entity — every
// other business lookup below goes through this, not a fresh SQL query.
function resolveBusinessEntity(business: string) {
  return Entity.get(business, 'Businesses');
}

// Same for "business + ledger name" -> the ledger's own entity, via the
// real Businesses -> <business> -> Ledgers -> <ledger> chain.
function resolveLedgerEntity(business: string, ledger: string) {
  const businessEntity = resolveBusinessEntity(business);
  const ledgersRoot = businessEntity ? Entity.getUnder('Ledgers', businessEntity.id) : undefined;
  return ledgersRoot ? Entity.getUnder(ledger, ledgersRoot.id) : undefined;
}

export function stageLine(line: StagedLine): void {
  if (!line.accountId) {
    const resolved = findLedgerScopedAccount(line.ledger, line.account);
    if (resolved) line.accountId = resolved;
  }
  db.prepare(
    `INSERT INTO journal_entry_staging (reference, business, ledger, description, transdate, account, account_id, amount_minor, memo, bank_reference)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (reference, business, ledger, account, account_id) DO UPDATE SET amount_minor = excluded.amount_minor, memo = excluded.memo, bank_reference = excluded.bank_reference, account_id = excluded.account_id`
  ).run(
    line.reference,
    line.business,
    line.ledger,
    line.description ?? '',
    line.transdate ?? null,
    line.account,
    line.accountId ?? null,
    line.amount_minor,
    line.memo ?? '',
    line.bankReference ?? null
  );
}

export function getStagedLines(reference: string, business: BusinessName, ledger: LedgerName): StagedLine[] {
  return db
    .prepare(
      `SELECT reference, business, ledger, description, transdate, account, amount_minor, memo, bank_reference AS bankReference
       FROM journal_entry_staging WHERE reference = ? AND business = ? AND ledger = ?`
    )
    .all(reference, business, ledger) as StagedLine[];
}

export interface RecurringJournalLine {
  account: string;
  amount_minor: number;
  memo?: string;
  effective_date?: string;
}

export type Recurrence = 'once' | 'weekly' | 'monthly' | 'yearly';

export function createRecurringJournal(
  business: BusinessName,
  ledger: LedgerName,
  reference: string,
  startDate: string,
  recurrence: Recurrence,
  lines: RecurringJournalLine[],
  userId: UserId,
  description?: string,
  recurrenceCount?: number
): void {
  assertPeriodOpen(business, ledger, startDate);

  const businessId = resolveBusinessEntity(business)?.id;
  const ledgerId = resolveLedgerEntity(business, ledger)?.id;
  if (!businessId) throw new ValidationError(`No business named "${business}".`);
  if (!ledgerId) throw new ValidationError(`No ledger named "${ledger}".`);

  const insertJournal = db.prepare(
    `INSERT INTO journal (business_id, ledger_id, reference, description, transdate, user_id, recurrence, recurrence_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const vivify = db.prepare(`INSERT OR IGNORE INTO account (entity_id) VALUES (?)`);
  const insertLine = db.prepare(
    `INSERT INTO journal_line (journal_id, account_id, effective_date, amount_minor, memo) VALUES (?, ?, ?, ?, ?)`
  );
  const getCurrency = db.prepare(`SELECT currency FROM account WHERE entity_id = ?`);

  const journalId = db.transaction(() => {
    // Resolve and vivify every referenced account FIRST, inside this same
    // transaction — the per-currency balance check just below needs each
    // line's real account.currency to exist, the same way
    // post_journal_entry_insert's own per-currency check (00-core.sql)
    // already requires for an ordinary posting. A vivified-but-unused
    // account row is harmless and rolls back with everything else if the
    // balance check below throws.
    const resolved = lines.map((line) => {
      const acctId = resolveBusinessCoaAccountId(business, line.account);
      vivify.run(acctId);
      return { line, acctId };
    });

    // Real, confirmed fix for the documented gap in docs/pm-journal-api.md:
    // this used to be one flat sum across every line regardless of
    // currency, so a recurring entry genuinely mixing currencies could
    // pass as "balanced" while not balancing in either currency on its
    // own — exactly the hole post_journal_entry_insert's own per-currency
    // grouping (00-core.sql) closes for every ordinary posting. Grouped
    // the same way here: only lines effective at the start date count
    // toward the start-date balance (a line whose effective_date is
    // later — e.g. the wage-increase amendment test — isn't part of what
    // must balance today), same as the original flat check already did;
    // NULL currency (an account's own home/reporting currency) is its
    // own group, same as the trigger's COALESCE(currency, '').
    const totalsByCurrency = new Map<string, number>();
    for (const { line, acctId } of resolved) {
      if (line.effective_date && line.effective_date !== startDate) continue;
      const currency = (getCurrency.get(acctId) as { currency: string | null } | undefined)?.currency ?? '';
      totalsByCurrency.set(currency, (totalsByCurrency.get(currency) ?? 0) + line.amount_minor);
    }
    for (const [currency, total] of totalsByCurrency) {
      if (total !== 0) {
        throw new PostingError(`This entry does not balance at its start date${currency ? ` in ${currency}` : ''} (off by ${total} minor units).`);
      }
    }

    const info = insertJournal.run(businessId, ledgerId, reference, description ?? '', startDate, userId, recurrence, recurrenceCount ?? null);
    const jid = Number(info.lastInsertRowid);
    for (const { line, acctId } of resolved) {
      insertLine.run(jid, acctId, line.effective_date ?? startDate, line.amount_minor, line.memo ?? '');
    }
    return jid;
  })();

  void journalId;
}

export function ensureLocationScopedAccount(baseAccountName: string, locationName: string, userId: UserId): string {
  const locationAccount = `${baseAccountName} — ${locationName}`;
  if (!Entity.get(locationAccount)) {
    const base = Entity.get(baseAccountName);
    if (!base) throw new ValidationError(`"${baseAccountName}" does not exist.`);
    Entity.create(locationAccount, baseAccountName, userId);
    setHierarchyParent(locationAccount, 'Location', locationName, userId);
  }
  return locationAccount;
}

export interface ARReceiptInput {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  customer: CustomerName;
  amount_minor: number;
  transdate?: string;
  description?: string;
}

export function stageARReceipt(input: ARReceiptInput): void {
  db.prepare(
    `INSERT INTO ar_receipt_staging (reference, business, ledger, customer, amount_minor, transdate, description)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (reference, business, ledger) DO UPDATE SET
       customer = excluded.customer, amount_minor = excluded.amount_minor,
       transdate = excluded.transdate, description = excluded.description`
  ).run(input.reference, input.business, input.ledger, input.customer, input.amount_minor, input.transdate ?? null, input.description ?? '');
}

export function postARReceipt(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {
  try {
    // ar_receipt_post_insert (00-core.sql) only builds the two-line
    // journal_entry_staging entry now — it no longer chains into
    // post_journal_entry (removed as part of Stage D), so the actual commit
    // is this separate, explicit postJournalEntry call.
    db.prepare(`INSERT INTO ar_receipt_post (reference, business, ledger, user_id) VALUES (?, ?, ?, ?)`).run(reference, business, ledger, userId);
  } catch (err) {
    throw new PostingError(err instanceof Error ? err.message : String(err));
  }
  postJournalEntry(reference, business, ledger, userId);
}

export interface APPaymentInput {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  vendor: ProviderName;
  amount_minor: number;
  transdate?: string;
  description?: string;
}

export function stageAPPayment(input: APPaymentInput): void {
  db.prepare(
    `INSERT INTO ap_payment_staging (reference, business, ledger, vendor, amount_minor, transdate, description)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (reference, business, ledger) DO UPDATE SET
       vendor = excluded.vendor, amount_minor = excluded.amount_minor,
       transdate = excluded.transdate, description = excluded.description`
  ).run(input.reference, input.business, input.ledger, input.vendor, input.amount_minor, input.transdate ?? null, input.description ?? '');
}

export function postAPPayment(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {
  try {
    // Same change as postARReceipt above: ap_payment_post_insert only stages
    // the two journal_entry_staging lines now; this explicit postJournalEntry
    // call is the actual commit.
    db.prepare(`INSERT INTO ap_payment_post (reference, business, ledger, user_id) VALUES (?, ?, ?, ?)`).run(reference, business, ledger, userId);
  } catch (err) {
    throw new PostingError(err instanceof Error ? err.message : String(err));
  }
  postJournalEntry(reference, business, ledger, userId);
}

export interface PurchaseOrderInput {
  reference: string;
  business: string;
  ledger: string;
  vendor: string;
  item: string;
  quantity: number;
  price_minor: number;
  location?: string;
  transdate?: string;
  description?: string;
}

export function stagePurchaseOrder(input: PurchaseOrderInput): void {
  db.prepare(
    `INSERT INTO po_staging (reference, business, ledger, vendor, item, quantity, price_minor, location, transdate, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (reference, business, ledger) DO UPDATE SET
       vendor = excluded.vendor, item = excluded.item, quantity = excluded.quantity,
       price_minor = excluded.price_minor, location = excluded.location, transdate = excluded.transdate, description = excluded.description`
  ).run(input.reference, input.business, input.ledger, input.vendor, input.item, input.quantity, input.price_minor, input.location ?? null, input.transdate ?? null, input.description ?? '');
}

export function postPurchaseOrder(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {
  const staged = db
    .prepare(`SELECT * FROM po_staging WHERE reference = ? AND business = ? AND ledger = ?`)
    .get(reference, business, ledger) as PurchaseOrderInput | undefined;
  if (!staged) throw new NotFoundError(`Nothing staged for purchase order ${reference}.`);
  placeOrder(reference, business, ledger, staged.quantity, staged.quantity * staged.price_minor, userId, staged.transdate, asProviderName(staged.vendor), asItemName(staged.item), staged.location ? asLocationName(staged.location) : undefined);
  db.prepare(`DELETE FROM po_staging WHERE reference = ? AND business = ? AND ledger = ?`).run(reference, business, ledger);
}

export interface EmployeeClock {
  employee: string;
  po_reference: string;
  project_expense_account: string;
  clocked_in_at: string;
}

export function clockInToProject(employeeName: EmployeeName, projectExpenseAccount: AccountName, business: BusinessName, ledger: LedgerName, userId: UserId): EmployeeClock {
  const contact = getContact(employeeName);
  if (!contact) throw new ValidationError(`No real contact named "${employeeName}".`);
  if (!contact.wage_minor_per_hour) throw new ValidationError(`"${employeeName}" has no real, configured hourly wage rate yet — set one on the Contacts page first.`);
  const employee = Entity.get(employeeName);
  if (!employee) throw new ValidationError(`No employee named "${employeeName}".`);
  const alreadyClocked = Entity.findByNameContaining('Clocked In — ', employee.id).some((e) => e.relation_id !== null);
  if (alreadyClocked) throw new ValidationError(`"${employeeName}" is already clocked in on a real project — clock out first.`);

  const clockedInAt = new Date().toISOString();
  const poReference = `CLOCK-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  stagePurchaseOrder({
    reference: poReference,
    business,
    ledger,
    vendor: employeeName,
    item: projectExpenseAccount,
    quantity: 1,
    price_minor: contact.wage_minor_per_hour,
    transdate: clockedInAt.slice(0, 10),
    description: `${employeeName}'s own real, standing time order against ${projectExpenseAccount}, accepted at clock-in`,
  });
  postPurchaseOrder(poReference, business, ledger, userId);

  const clockEntity = Entity.create(`Clocked In — ${poReference} — ${projectExpenseAccount} — ${clockedInAt}`, employee.id, userId);
  Entity.relate(clockEntity.id, 'Active', userId);
  return { employee: employeeName, po_reference: poReference, project_expense_account: projectExpenseAccount, clocked_in_at: clockedInAt };
}

// Real, found-and-fixed bug (Project Builder tutorial, Stage 7): a
// clock entity's own name is `Clocked In — ${poReference} — ${account} —
// ${clockedInAt}`, but a real Profit-Center-scoped project expense
// account (provisionProjectProfitCenter, db-projects.ts) is itself named
// `${projectName} — Labour & Plant` — it carries its own " — ", so a
// naive 4-way split(' — ') silently misparses every field after
// poReference once a real account name like that is used (confirmed:
// the account name truncates and clockedInAt ends up as a non-date
// fragment of the account's own name, producing NaN hours worked and a
// NOT NULL constraint failure on the resulting stock receipt). poReference
// never contains " — " (it's always `CLOCK-<timestamp>-<random>` or
// `PLANT-CLOCK-<timestamp>-<random>`) and clockedInAt never contains it
// either (always a bare ISO timestamp), so only the account name in the
// middle can genuinely vary in how many " — "-separated segments it has —
// splitting from both ends and rejoining whatever is left in the middle
// handles any real account name, not just ones with zero em dashes of
// their own.
function getOpenProjectClockEntity(employeeName: string): { id: number; po_reference: string; project_expense_account: string; clocked_in_at: string } | undefined {
  const employee = Entity.get(employeeName);
  if (!employee) return undefined;
  const row = Entity.findByNameContaining('Clocked In — ', employee.id).find((e) => e.relation_id !== null);
  if (!row) return undefined;
  const parts = row.name.split(' — ');
  const poReference = parts[1];
  const clockedInAt = parts[parts.length - 1];
  const projectExpenseAccount = parts.slice(2, parts.length - 1).join(' — ');
  return { id: row.id, po_reference: poReference, project_expense_account: projectExpenseAccount, clocked_in_at: clockedInAt };
}

export function clockOutOfProject(employeeName: EmployeeName, business: BusinessName, ledger: LedgerName, userId: UserId): void {
  const open = getOpenProjectClockEntity(employeeName);
  if (!open) throw new ValidationError(`"${employeeName}" is not currently clocked in on any real project.`);

  const contact = getContact(employeeName)!;
  const clockedOutAt = new Date();
  const clockedInAt = new Date(open.clocked_in_at);
  const realHoursWorked = Math.max(0, (clockedOutAt.getTime() - clockedInAt.getTime()) / (1000 * 60 * 60));
  const valueMinor = Math.round(realHoursWorked * contact.wage_minor_per_hour!);

  const receiptReference = `${open.po_reference}-RECEIPT`;
  stageOrderReceipt({
    reference: receiptReference,
    business,
    ledger,
    po_reference: open.po_reference,
    item: open.project_expense_account,
    vendor: employeeName,
    quantity: realHoursWorked,
    value_minor: valueMinor,
    transdate: clockedOutAt.toISOString().slice(0, 10),
    description: `${realHoursWorked.toFixed(2)} real hours worked, clock-in to clock-out, at ${employeeName}'s own real wage rate — real delivery of the standing time order accepted at clock-in, now genuinely liable to payment`,
  });
  postOrderReceipt(receiptReference, business, ledger, userId);

  Entity.relate(open.id, null, asUserId(1));
}

export function getOpenProjectClockForEmployee(employeeName: EmployeeName): EmployeeClock | undefined {
  const open = getOpenProjectClockEntity(employeeName);
  if (!open) return undefined;
  return { employee: employeeName, po_reference: open.po_reference, project_expense_account: open.project_expense_account, clocked_in_at: open.clocked_in_at };
}

// Plant's own clock-in/out — a direct structural copy of
// clockInToProject/clockOutOfProject above, substituting the Plant
// item's own Hourly Rate (Entity.setAttr-backed, db.ts's getPlantItem)
// for contact.wage_minor_per_hour. `vendor` here is the Plant item's own
// name, cast the exact same loose way the employee clock already casts
// an Employee name as a ProviderName (asProviderName is a pure brand, no
// runtime "must be a real AP contact" check) — confirmed by reading
// placeOrder/postPurchaseOrder directly before reusing this shape.
export interface PlantClock {
  plant: string;
  po_reference: string;
  project_expense_account: string;
  clocked_in_at: string;
}

export function clockPlantIn(plantName: string, projectExpenseAccount: AccountName, business: BusinessName, ledger: LedgerName, userId: UserId): PlantClock {
  const plant = getPlantItem(plantName);
  if (!plant) throw new ValidationError(`No real Plant item named "${plantName}" — create it first.`);
  const entity = Entity.get(plantName);
  if (!entity) throw new ValidationError(`No entity named "${plantName}".`);
  const alreadyClocked = Entity.findByNameContaining('Clocked In — ', entity.id).some((e) => e.relation_id !== null);
  if (alreadyClocked) throw new ValidationError(`"${plantName}" is already clocked in on a real project — clock out first.`);

  const clockedInAt = new Date().toISOString();
  const poReference = `PLANT-CLOCK-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  stagePurchaseOrder({
    reference: poReference,
    business,
    ledger,
    vendor: plant.hireVendor ?? plantName,
    item: projectExpenseAccount,
    quantity: 1,
    price_minor: plant.hourlyRateMinor,
    transdate: clockedInAt.slice(0, 10),
    description: `${plantName}'s own real, standing time order against ${projectExpenseAccount}, accepted at clock-in`,
  });
  postPurchaseOrder(poReference, business, ledger, userId);

  const clockEntity = Entity.create(`Clocked In — ${poReference} — ${projectExpenseAccount} — ${clockedInAt}`, entity.id, userId);
  Entity.relate(clockEntity.id, 'Active', userId);
  return { plant: plantName, po_reference: poReference, project_expense_account: projectExpenseAccount, clocked_in_at: clockedInAt };
}

export function clockPlantOut(plantName: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {
  const open = getOpenProjectClockEntity(plantName);
  if (!open) throw new ValidationError(`"${plantName}" is not currently clocked in on any real project.`);

  const plant = getPlantItem(plantName)!;
  const clockedOutAt = new Date();
  const clockedInAt = new Date(open.clocked_in_at);
  const realHoursWorked = Math.max(0, (clockedOutAt.getTime() - clockedInAt.getTime()) / (1000 * 60 * 60));
  const valueMinor = Math.round(realHoursWorked * plant.hourlyRateMinor);

  const receiptReference = `${open.po_reference}-RECEIPT`;
  stageOrderReceipt({
    reference: receiptReference,
    business,
    ledger,
    po_reference: open.po_reference,
    item: open.project_expense_account,
    vendor: plant.hireVendor ?? plantName,
    quantity: realHoursWorked,
    value_minor: valueMinor,
    transdate: clockedOutAt.toISOString().slice(0, 10),
    description: `${realHoursWorked.toFixed(2)} real hours, clock-in to clock-out, at ${plantName}'s own real hourly rate — real delivery of the standing time order accepted at clock-in, now genuinely liable to payment`,
  });
  postOrderReceipt(receiptReference, business, ledger, userId);

  Entity.relate(open.id, null, asUserId(1));
}

export function getOpenPlantClock(plantName: string): PlantClock | undefined {
  const open = getOpenProjectClockEntity(plantName);
  if (!open) return undefined;
  return { plant: plantName, po_reference: open.po_reference, project_expense_account: open.project_expense_account, clocked_in_at: open.clocked_in_at };
}

export interface OrderReceiptInput {
  reference: string;
  business: string;
  ledger: string;
  po_reference: string;
  item: string;
  item_qty?: string | null;
  vendor: string;
  quantity: number;
  value_minor: number;
  tax_minor?: number;
  transdate?: string;
  description?: string;
}

export function stageOrderReceipt(input: OrderReceiptInput): void {
  db.prepare(
    `INSERT INTO stock_receipt_staging
       (reference, business, ledger, po_reference, item, item_qty, vendor, quantity, value_minor, tax_minor, transdate, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (reference, business, ledger) DO UPDATE SET
       po_reference = excluded.po_reference, item = excluded.item, item_qty = excluded.item_qty,
       vendor = excluded.vendor, quantity = excluded.quantity, value_minor = excluded.value_minor,
       tax_minor = excluded.tax_minor, transdate = excluded.transdate, description = excluded.description`
  ).run(
    input.reference, input.business, input.ledger, input.po_reference, input.item, input.item_qty ?? null,
    input.vendor, input.quantity, input.value_minor, input.tax_minor ?? 0, input.transdate ?? null, input.description ?? ''
  );
}

export function postOrderReceipt(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {
  const staged = db
    .prepare(`SELECT * FROM stock_receipt_staging WHERE reference = ? AND business = ? AND ledger = ?`)
    .get(reference, business, ledger) as (OrderReceiptInput & { tax_minor: number }) | undefined;
  if (!staged) throw new NotFoundError(`Nothing staged for stock receipt ${reference}.`);

  if (staged.item_qty) {
    postQuantityMovement(business, ledger, `${reference}-QTY`, asAccountName(staged.item_qty), staged.quantity, userId, staged.transdate);
  }
  stageLine({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), description: staged.description, transdate: staged.transdate, account: asAccountName(staged.item), amount_minor: staged.value_minor });
  if (staged.tax_minor) {
    stageLine({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), description: staged.description, transdate: staged.transdate, account: asAccountName('Purchases Tax Claimed'), amount_minor: staged.tax_minor });
  }
  stageLine({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), description: staged.description, transdate: staged.transdate, account: asAccountName(staged.vendor), amount_minor: -(staged.value_minor + staged.tax_minor) });
  postJournalEntry(reference, business, ledger, userId);
  fulfillOrder(staged.po_reference, reference, business, ledger, staged.quantity, staged.value_minor, userId, staged.transdate);

  recordInvoiceLine(
    reference, business, ledger, staged.description || 'Receipt', staged.quantity,
    staged.quantity > 0 ? Math.round(staged.value_minor / staged.quantity) : null, staged.value_minor, staged.tax_minor
  );

  db.prepare(`DELETE FROM stock_receipt_staging WHERE reference = ? AND business = ? AND ledger = ?`).run(reference, business, ledger);
}

export interface LocationStagingInput {
  reference: string;
  business: BusinessName;
  location_name: string;
  city: string;
  location_type: string;
  bottle_capacity?: number | null;
  carton_capacity?: number | null;
  timezone: string;
}

export function stageLocation(input: LocationStagingInput): void {
  db.prepare(
    `INSERT INTO location_staging
       (reference, business, location_name, city, location_type, bottle_capacity, carton_capacity, timezone)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (reference, business) DO UPDATE SET
       location_name = excluded.location_name, city = excluded.city, location_type = excluded.location_type,
       bottle_capacity = excluded.bottle_capacity, carton_capacity = excluded.carton_capacity, timezone = excluded.timezone`
  ).run(
    input.reference, input.business, input.location_name, input.city, input.location_type,
    input.bottle_capacity ?? null, input.carton_capacity ?? null, input.timezone
  );
}

export function postLocation(reference: string, business: BusinessName, userId: UserId): TypedNode<'LocationEntityName'> {
  const staged = db.prepare(`SELECT * FROM location_staging WHERE reference = ? AND business = ?`).get(reference, business) as LocationStagingInput | undefined;
  if (!staged) throw new NotFoundError(`Nothing staged for location ${reference}.`);

  return db.transaction((): TypedNode<'LocationEntityName'> => {
    const entity = createLocation(business, staged.location_name, userId);
    setLocation(asLocationName(staged.location_name), {
      city: staged.city,
      location_type: staged.location_type,
      is_billing_address: false,
      bottle_capacity: staged.bottle_capacity ?? null,
      carton_capacity: staged.carton_capacity ?? null,
      timezone: staged.timezone,
    } as StockLocation, business);
    // See the matching comment in createAndConfigureLocation (db.ts) - a
    // staged location's capacity account belongs in whichever ledger is
    // genuinely active now, not forever "Actual".
    ensureLocationCapacityAccount(business, getActiveLedger(business) ?? asLedgerName('Actual'), asLocationName(staged.location_name), userId);
    setRelationship(staged.location_name, 'Belongs To Group', staged.location_name, userId);
    db.prepare(`DELETE FROM location_staging WHERE reference = ? AND business = ?`).run(reference, business);
    return entity;
  })();
}

export interface SalesOrderInput {
  reference: string;
  business: string;
  ledger: string;
  customer: string;
  item: string;
  quantity: number;
  price_minor: number;
  location?: string;
  transdate?: string;
  description?: string;
}

export function stageSalesOrder(input: SalesOrderInput): void {
  db.prepare(
    `INSERT INTO so_staging (reference, business, ledger, customer, item, quantity, price_minor, location, transdate, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (reference, business, ledger) DO UPDATE SET
       customer = excluded.customer, item = excluded.item, quantity = excluded.quantity,
       price_minor = excluded.price_minor, location = excluded.location, transdate = excluded.transdate, description = excluded.description`
  ).run(input.reference, input.business, input.ledger, input.customer, input.item, input.quantity, input.price_minor, input.location ?? null, input.transdate ?? null, input.description ?? '');
}

export function postSalesOrder(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {
  const staged = db
    .prepare(`SELECT * FROM so_staging WHERE reference = ? AND business = ? AND ledger = ?`)
    .get(reference, business, ledger) as SalesOrderInput | undefined;
  if (!staged) throw new NotFoundError(`Nothing staged for sales order ${reference}.`);
  placeOrder(reference, business, ledger, staged.quantity, staged.quantity * staged.price_minor, userId, staged.transdate, undefined, asItemName(staged.item), staged.location ? asLocationName(staged.location) : undefined);
  db.prepare(`DELETE FROM so_staging WHERE reference = ? AND business = ? AND ledger = ?`).run(reference, business, ledger);
}

export interface OrderDispatchInput {
  reference: string;
  business: string;
  ledger: string;
  so_reference: string;
  item?: string | null;
  item_qty?: string | null;
  customer: string;
  quantity: number;
  unit_cost_minor?: number | null;
  sale_price_minor: number;
  tax_minor?: number;
  transdate?: string;
  description?: string;
}

export function stageOrderDispatch(input: OrderDispatchInput): void {
  db.prepare(
    `INSERT INTO stock_dispatch_staging
       (reference, business, ledger, so_reference, item, item_qty, customer, quantity, unit_cost_minor, sale_price_minor, tax_minor, transdate, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (reference, business, ledger) DO UPDATE SET
       so_reference = excluded.so_reference, item = excluded.item, item_qty = excluded.item_qty,
       customer = excluded.customer, quantity = excluded.quantity, unit_cost_minor = excluded.unit_cost_minor,
       sale_price_minor = excluded.sale_price_minor, tax_minor = excluded.tax_minor,
       transdate = excluded.transdate, description = excluded.description`
  ).run(
    input.reference, input.business, input.ledger, input.so_reference, input.item ?? null, input.item_qty ?? null,
    input.customer, input.quantity, input.unit_cost_minor ?? null, input.sale_price_minor, input.tax_minor ?? 0,
    input.transdate ?? null, input.description ?? ''
  );
}

export function postOrderDispatch(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {
  const staged = db
    .prepare(`SELECT * FROM stock_dispatch_staging WHERE reference = ? AND business = ? AND ledger = ?`)
    .get(reference, business, ledger) as (OrderDispatchInput & { tax_minor: number }) | undefined;
  if (!staged) throw new NotFoundError(`Nothing staged for stock dispatch ${reference}.`);

  const saleAmount = staged.quantity * staged.sale_price_minor;

  stageLine({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), description: staged.description, transdate: staged.transdate, account: asAccountName(staged.customer), amount_minor: saleAmount + staged.tax_minor });
  stageLine({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), description: staged.description, transdate: staged.transdate, account: asAccountName('Sales Revenue'), amount_minor: -saleAmount });
  if (staged.tax_minor) {
    stageLine({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), description: staged.description, transdate: staged.transdate, account: asAccountName('Sales Tax Payable'), amount_minor: -staged.tax_minor });
  }
  postJournalEntry(reference, business, ledger, userId);

  if (staged.item && staged.unit_cost_minor != null) {
    const cogsAmount = staged.quantity * staged.unit_cost_minor;
    const cogsReference = `${reference}-COGS`;
    stageLine({ reference: cogsReference, business: asBusinessName(business), ledger: asLedgerName(ledger), description: 'Cost of goods sold', transdate: staged.transdate, account: asAccountName('Cost of Goods Sold'), amount_minor: cogsAmount });
    stageLine({ reference: cogsReference, business: asBusinessName(business), ledger: asLedgerName(ledger), description: 'Cost of goods sold', transdate: staged.transdate, account: asAccountName(staged.item), amount_minor: -cogsAmount });
    postJournalEntry(cogsReference, business, ledger, userId);
  }
  if (staged.item_qty) {
    postQuantityMovement(business, ledger, `${reference}-QTY`, asAccountName(staged.item_qty), -staged.quantity, userId, staged.transdate);
  }
  fulfillOrder(staged.so_reference, reference, business, ledger, staged.quantity, saleAmount, userId, staged.transdate);

  recordInvoiceLine(reference, business, ledger, staged.description || 'Dispatch', staged.quantity, staged.sale_price_minor, saleAmount, staged.tax_minor);

  db.prepare(`DELETE FROM stock_dispatch_staging WHERE reference = ? AND business = ? AND ledger = ?`).run(reference, business, ledger);
}

export function removeStagedLine(reference: string, business: BusinessName, ledger: LedgerName, account: string): void {
  db.prepare(
    `DELETE FROM journal_entry_staging WHERE reference = ? AND business = ? AND ledger = ? AND account = ?`
  ).run(reference, business, ledger, account);
}

export class PostingError extends Error {}

interface StagingRow {
  reference: string;
  business: string;
  ledger: string;
  description: string;
  transdate: string | null;
  account: string;
  account_id: number | null;
  amount_minor: number;
  memo: string;
  bank_reference: string | null;
}

// Stage D (/root/.claude/plans/stateful-snacking-adleman.md): business/ledger
// id resolution, originally ported verbatim from post_journal_entry_insert/
// post_quantity_movement_insert's own shared COALESCE chain (00-core.sql) as
// raw, read-only SQL. Converted to go through entityDriver (Stage E) once it
// was confirmed — not assumed — that these three functions were never
// structurally tied to staying raw SQL at all: none of them joins
// current_entities against account/journal/invoice in the same statement
// (the actual category-4 pattern the plan reserves for raw SQL), they're
// pure name/id resolution, and they already run entirely BEFORE the write
// transaction below opens — exactly the ordering the plan calls for ("entity
// resolution never happens inside an open transaction"), so routing them
// through a driver that may call out to Kaappi is safe here, not just
// theoretically compatible. The real reason they were raw SQL was "byte-for-
// byte identical to the replaced trigger," not a structural constraint — and
// leaving them raw SQL is exactly what made every live-created business
// invisible to posting under ENTITY_DRIVER=kaappi (confirmed directly: the
// very first real Stage E run hit "NOT NULL constraint failed:
// journal.business_id" on a business that only ever existed in Kaappi).
// Re-verified via the same direct before/after balance diff Stage D's own
// original conversion used, given this is still money-moving logic.
function resolveStagingBusinessId(business: string): number | undefined {
  // The original SQL scoped parent_id to whichever of 'Businesses'/
  // 'Application' actually has a child with this name — both are
  // singular, global roots by this schema's own design (the same
  // assumption the original SQL's bare `name IN (...)` subquery already
  // depended on), so checking each in turn is behavior-equivalent, just
  // explicit about which root matched instead of leaving it to SQLite's
  // own unordered IN-subquery evaluation.
  for (const rootName of ['Businesses', 'Application'] as const) {
    const root = Entity.get(rootName);
    if (!root) continue;
    const node = Entity.getUnder(business, root.id);
    if (node) return node.id;
  }
  return undefined;
}

function resolveStagingLedgerId(ledger: string, businessId: number | undefined): number | undefined {
  if (businessId === undefined) return undefined;
  const ledgersRoot = Entity.getUnder('Ledgers', businessId);
  if (!ledgersRoot) return undefined;
  return Entity.getUnder(ledger, ledgersRoot.id)?.id;
}

// Same reasoning as above: the trigger's own per-line account fallback — a
// business-scoped Chart-of-Accounts walk first, then a bare, unscoped name
// lookup as a deliberate fallback for the one legacy business ('admin'/'My
// Business') with no Chart of Accounts copy of its own. Most staged lines
// never reach this at all — stageLine already resolves account_id itself via
// the ledger-scoped lookup wherever it can; this is only the trigger's own
// last-resort path for a line that arrived without one.
function resolveStagedAccountId(business: string, accountName: string): number | undefined {
  const businessId = resolveStagingBusinessId(business);
  if (businessId !== undefined) {
    const coaRoot = Entity.getUnder('Chart of Accounts', businessId);
    if (coaRoot) {
      // The original biz_coa CTE includes the Chart of Accounts root node
      // ITSELF (depth 0), not just its descendants — descendantsWithDepth
      // does too, on both drivers (see kaappi-entity-driver.ts's own note on
      // bringing it into parity with SqlEntityDriver for exactly this site).
      const match = Entity.descendantsWithDepth(coaRoot.id).find((node) => node.name === accountName);
      if (match) return match.id;
    }
  }
  // Deliberately the same unscoped, unordered, no-disambiguation fallback
  // the original trigger's own SQL had (`LIMIT 1`, no ORDER BY) — a known,
  // pre-existing weakness (the one legacy business with no Chart of
  // Accounts copy of its own), not something this conversion should "fix"
  // by adding an ordering the original never had.
  return Entity.get(accountName)?.id;
}

interface CommitStagedEntryOptions {
  // post_journal_entry_insert enforces per-currency balance; post_quantity_movement_insert
  // deliberately does not (see 00-core.sql's own comment on why — Balance.post's documented,
  // genuinely-intentional single-sided use for standalone figures like Min/Max/Reorder/Shelf Level).
  requireBalance: boolean;
  // Only post_journal_entry_insert's journal_line insert carries bank_reference;
  // post_quantity_movement_insert's own INSERT INTO journal_line omits that column entirely.
  includeBankReference: boolean;
  // Stamps journal.recurrence/recurrence_count directly, the same columns
  // createRecurringJournal (below) sets — reused here, rather than
  // reinventing a second scheduling mechanism, for db-stock.ts's
  // placeOrder: a standing order's own quantity/value "on order" posting
  // is deliberately single-sided (requireBalance: false), which
  // createRecurringJournal's own balanced-lines API cannot express, so
  // placeOrder stamps recurrence through this lower-level path instead —
  // same schema, same journal_occurrences expansion, different entry
  // point for a different shape of entry. Omitted/undefined means
  // 'once'/null, exactly like every other caller today.
  recurrence?: Recurrence;
  recurrenceCount?: number;
}

// Stage D: the shared orchestration both post_journal_entry_insert and
// post_quantity_movement_insert's own INSTEAD OF INSERT trigger bodies
// (00-core.sql) used to perform, now in TypeScript. Replaces both triggers;
// see postJournalEntry below and db-stock.ts's postStagedQuantityMovement.
function commitStagedEntry(reference: string, business: string, ledger: string, userId: UserId, opts: CommitStagedEntryOptions): void {
  const staged = db
    .prepare(
      `SELECT reference, business, ledger, description, transdate, account, account_id, amount_minor, memo, bank_reference
       FROM journal_entry_staging WHERE reference = ? AND business = ? AND ledger = ?`
    )
    .all(reference, business, ledger) as StagingRow[];
  if (staged.length === 0) {
    throw new ValidationError('nothing staged for this reference/business/ledger');
  }

  const transdate = staged[0].transdate ?? new Date().toISOString().slice(0, 10);

  // Same lock check post_journal_entry_insert/post_quantity_movement_insert's own
  // RAISE performs, via the exact same TS-side status function assertPeriodOpen
  // already uses elsewhere — not a second, independently-written implementation
  // of the same lock-reading logic.
  const lockedThroughDate = getPeriodLockStatus(business as BusinessName, ledger as LedgerName).locked_through_date;
  if (lockedThroughDate != null && transdate <= lockedThroughDate) {
    throw new ValidationError('this period is closed to normal posting — reopen it first if this is a genuine correction');
  }

  const resolved = staged.map((s) => ({
    ...s,
    resolvedAccountId: s.account_id ?? resolveStagedAccountId(business, s.account),
  }));

  // Unlike the trigger (which would only fail later, accidentally, on
  // journal_line's NOT NULL account_id constraint, after already vivifying a
  // bogus auto-id account row for the NULL case — a SQLite INTEGER PRIMARY KEY
  // quirk), fail clearly up front, before touching the database at all. Same
  // end result (nothing committed), clearer cause.
  const unresolved = resolved.find((s) => s.resolvedAccountId === undefined);
  if (unresolved) {
    throw new ValidationError(`No real account named "${unresolved.account}" to post against.`);
  }

  if (opts.requireBalance) {
    const groups = new Map<string, number>();
    for (const s of resolved) {
      const currency =
        (db.prepare(`SELECT currency FROM account WHERE entity_id = ?`).get(s.resolvedAccountId!) as { currency: string | null } | undefined)?.currency ?? '';
      groups.set(currency, (groups.get(currency) ?? 0) + s.amount_minor);
    }
    for (const sum of groups.values()) {
      if (sum !== 0) throw new ValidationError('entry does not balance (per currency)');
    }
  }

  const businessId = resolveStagingBusinessId(business);
  const ledgerId = resolveStagingLedgerId(ledger, businessId);
  const description = staged[0].description;

  db.transaction(() => {
    for (const s of resolved) {
      db.prepare(`INSERT OR IGNORE INTO account (entity_id) VALUES (?)`).run(s.resolvedAccountId!);
    }

    db.prepare(`INSERT INTO journal (business_id, ledger_id, reference, description, transdate, user_id, recurrence, recurrence_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      businessId ?? null,
      ledgerId ?? null,
      reference,
      description,
      transdate,
      userId,
      opts.recurrence ?? 'once',
      opts.recurrenceCount ?? null
    );
    const journalId = (
      db.prepare(`SELECT id FROM journal WHERE reference = ? AND business_id = ? AND ledger_id = ?`).get(reference, businessId, ledgerId) as { id: number }
    ).id;

    for (const s of resolved) {
      if (opts.includeBankReference) {
        db.prepare(`INSERT INTO journal_line (journal_id, account_id, effective_date, amount_minor, memo, bank_reference) VALUES (?, ?, ?, ?, ?, ?)`).run(
          journalId,
          s.resolvedAccountId!,
          transdate,
          s.amount_minor,
          s.memo,
          s.bank_reference
        );
      } else {
        db.prepare(`INSERT INTO journal_line (journal_id, account_id, effective_date, amount_minor, memo) VALUES (?, ?, ?, ?, ?)`).run(
          journalId,
          s.resolvedAccountId!,
          transdate,
          s.amount_minor,
          s.memo
        );
      }
      // Same rule createRecurringJournal already follows: a recurring
      // entry's balance effect is read exclusively via journal_occurrences
      // (expanded per schedule date), never via this running cache column
      // — updating it here for a recurring entry would only ever reflect
      // this one, first occurrence, silently wrong from the second
      // occurrence on. Untouched (as already) for the 'once' case.
      if ((opts.recurrence ?? 'once') === 'once') {
        db.prepare(`UPDATE account SET balance_minor = balance_minor + ? WHERE entity_id = ?`).run(s.amount_minor, s.resolvedAccountId!);
      }
    }

    db.prepare(`DELETE FROM journal_entry_staging WHERE reference = ? AND business = ? AND ledger = ?`).run(reference, business, ledger);
  })();
}

export function postJournalEntry(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {
  try {
    commitStagedEntry(reference, business, ledger, userId, { requireBalance: true, includeBankReference: true });
  } catch (err) {
    throw new PostingError(err instanceof Error ? err.message : String(err));
  }
}

export function commitStagedQuantityMovement(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId, recurrence?: Recurrence, recurrenceCount?: number): void {
  try {
    commitStagedEntry(reference, business, ledger, userId, { requireBalance: false, includeBankReference: false, recurrence, recurrenceCount });
  } catch (err) {
    throw new PostingError(err instanceof Error ? err.message : String(err));
  }
}

export interface JournalSummary {
  journal_id: number;
  occurrence_date: string | null;
  reference: string;
  description: string;
  business: string;
  ledger: string;
  recurrence: string;
  posted_by: string;
  total_debit_minor: number;
  total_credit_minor: number;
  currency: string | null;
}

// posted_by resolution (shared by listJournalEntries/getJournalEntry): the
// same COALESCE(u.name, CASE WHEN user_id = 1 THEN 'admin' ELSE NULL END)
// the old SQL's LEFT JOIN did — a real, currently-existing child of
// 'System Users' wins; user_id 1 (the system/seed user) falls back to the
// literal "admin"; anything else resolves to null, same as the original.
function resolvePostedBy(userId: number, usersRoot: ReturnType<typeof Entity.get>): string | null {
  const userNode = Entity.get(userId);
  return (userNode && usersRoot && userNode.parent_id === usersRoot.id ? userNode.name : null) ?? (userId === 1 ? 'admin' : null);
}

export function listJournalEntries(business: BusinessName, ledger: LedgerName, limit = 100, offset = 0): JournalSummary[] {
  const businessEntity = resolveBusinessEntity(business);
  const ledgerEntity = resolveLedgerEntity(business, ledger);
  if (!businessEntity || !ledgerEntity) return [];
  const usersRoot = Entity.get('System Users');
  const rows = db
    .prepare(
      `SELECT jo.journal_id, jo.transdate AS occurrence_date, jo.reference, jo.description,
              j.recurrence, jo.user_id AS user_id, a.currency AS currency,
              COALESCE(SUM(CASE WHEN jo.amount_minor > 0 THEN jo.amount_minor ELSE 0 END), 0) AS total_debit_minor,
              COALESCE(SUM(CASE WHEN jo.amount_minor < 0 THEN -jo.amount_minor ELSE 0 END), 0) AS total_credit_minor
       FROM journal_occurrences jo
       JOIN journal j ON j.id = jo.journal_id
       JOIN account a ON a.entity_id = jo.account_id
       WHERE jo.business_id = ? AND jo.ledger_id = ?
       GROUP BY jo.journal_id, jo.transdate, a.currency
       ORDER BY jo.transdate DESC, jo.journal_id DESC
       LIMIT ? OFFSET ?`
    )
    .all(businessEntity.id, ledgerEntity.id, limit, offset) as {
    journal_id: number;
    occurrence_date: string | null;
    reference: string;
    description: string;
    recurrence: string;
    user_id: number;
    currency: string | null;
    total_debit_minor: number;
    total_credit_minor: number;
  }[];
  return rows.map((r) => ({
    journal_id: r.journal_id,
    occurrence_date: r.occurrence_date,
    reference: r.reference,
    description: r.description,
    business,
    ledger,
    recurrence: r.recurrence,
    posted_by: resolvePostedBy(r.user_id, usersRoot) as string,
    total_debit_minor: r.total_debit_minor,
    total_credit_minor: r.total_credit_minor,
    currency: r.currency,
  }));
}

export function countJournalEntries(business: BusinessName, ledger: LedgerName): number {
  const businessEntity = resolveBusinessEntity(business);
  const ledgerEntity = resolveLedgerEntity(business, ledger);
  if (!businessEntity || !ledgerEntity) return 0;
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total FROM (
         SELECT 1
         FROM journal_occurrences jo
         JOIN account a ON a.entity_id = jo.account_id
         WHERE jo.business_id = ? AND jo.ledger_id = ?
         GROUP BY jo.journal_id, jo.transdate, a.currency
       )`
    )
    .get(businessEntity.id, ledgerEntity.id) as { total: number };
  return row.total;
}

export interface JournalDetail extends JournalSummary {
  lines: { account: string; accountnumber: string | null; amount_minor: number; memo: string }[];
}

export function getJournalEntry(business: BusinessName, ledger: LedgerName, journalId: number, occurrenceDate: string): JournalDetail | undefined {
  const businessEntity = resolveBusinessEntity(business);
  const ledgerEntity = resolveLedgerEntity(business, ledger);
  if (!businessEntity || !ledgerEntity) return undefined;

  const header = db
    .prepare(
      `SELECT jo.journal_id, jo.transdate AS occurrence_date, jo.reference, jo.description, j.recurrence, jo.user_id AS user_id
       FROM journal_occurrences jo
       JOIN journal j ON j.id = jo.journal_id
       WHERE jo.journal_id = ? AND jo.transdate = ? AND jo.business_id = ? AND jo.ledger_id = ?
       LIMIT 1`
    )
    .get(journalId, occurrenceDate, businessEntity.id, ledgerEntity.id) as
    | { journal_id: number; occurrence_date: string; reference: string; description: string; recurrence: string; user_id: number }
    | undefined;
  if (!header) return undefined;

  const usersRoot = Entity.get('System Users');
  const posted_by = resolvePostedBy(header.user_id, usersRoot) as string;

  const rawLines = db
    .prepare(
      `SELECT jo.account_id AS account_id, a.accountnumber, jo.amount_minor, jo.memo
       FROM journal_occurrences jo
       LEFT JOIN account a ON a.entity_id = jo.account_id
       WHERE jo.journal_id = ? AND jo.transdate = ?`
    )
    .all(journalId, occurrenceDate) as { account_id: number; accountnumber: string | null; amount_minor: number; memo: string }[];
  // The original query INNER JOINed current_entities for the account name,
  // so a line whose account entity no longer resolves was silently
  // dropped — getMany + filter reproduces that exactly, rather than a
  // LEFT JOIN's "keep the row with an empty name" behavior.
  const accountNodes = new Map(Entity.getMany(rawLines.map((l) => l.account_id)).map((n) => [n.id, n] as const));
  const lines = rawLines
    .filter((l) => accountNodes.has(l.account_id))
    .map((l) => ({ account: accountNodes.get(l.account_id)!.name, accountnumber: l.accountnumber, amount_minor: l.amount_minor, memo: l.memo }));

  const total_debit_minor = lines.filter((l) => l.amount_minor > 0).reduce((s, l) => s + l.amount_minor, 0);
  const total_credit_minor = lines.filter((l) => l.amount_minor < 0).reduce((s, l) => s - l.amount_minor, 0);

  return {
    journal_id: header.journal_id,
    occurrence_date: header.occurrence_date,
    reference: header.reference,
    description: header.description,
    business,
    ledger,
    recurrence: header.recurrence,
    posted_by,
    lines,
    total_debit_minor,
    total_credit_minor,
    currency: null,
  };
}

export interface PeriodLockStatus {
  locked_through_date: string | null;
  changed_by: number | null;
  changed_at: string | null;
}

export interface LedgerDateRange {
  earliest: string | null;
  latest: string | null;
}

export function getLedgerDateRange(businessName: BusinessName, ledgerName: LedgerName): LedgerDateRange {
  const ledgerEntity = resolveLedgerEntity(businessName, ledgerName);
  const row = db
    .prepare(`SELECT MIN(transdate) AS earliest, MAX(transdate) AS latest FROM journal WHERE ledger_id = ? AND reference NOT LIKE 'CLOSE-%'`)
    .get(ledgerEntity?.id ?? -1) as { earliest: string | null; latest: string | null };
  return row;
}

export function getPeriodLockStatus(business: BusinessName, ledger: LedgerName): PeriodLockStatus {
  const ledgerEntity = resolveLedgerEntity(business, ledger);
  if (!ledgerEntity) return { locked_through_date: null, changed_by: null, changed_at: null };
  const lockEntityPrefix = `${business} — ${ledger} — Period Lock`;
  // Genuine substring search (the prefix-match "%" is a suffix wildcard on a
  // known literal prefix, so findByNameContaining's own "%fragment%" isn't
  // quite it either — but since this node is always the ONLY current child
  // of this ledger whose name starts with lockEntityPrefix, by construction
  // (ensurePeriodLockEntity below never creates a second one), scoping to
  // this ledger's children and filtering by prefix in TypeScript is exactly
  // equivalent, not an approximation.
  const row = Entity.children(ledgerEntity.id).find((e) => e.name.startsWith(lockEntityPrefix));
  if (!row) return { locked_through_date: null, changed_by: null, changed_at: null };
  // created_at/created_by aren't part of EntityNode/EntityDriver at all (no
  // driver method exposes them) — a genuine interface gap, not something
  // this conversion can route through entityDriver honestly. Left as one
  // narrow, by-id raw read rather than silently calling db.ts's getEntity
  // (the SQL backing primitive proper, not a sanctioned general-purpose
  // helper) to fetch the same two fields.
  const timestamps = db.prepare(`SELECT created_at, created_by FROM current_entities WHERE id = ?`).get(row.id) as { created_at: string; created_by: number };
  const suffix = row.name.slice(lockEntityPrefix.length);
  const throughDate = suffix.startsWith(' — Locked through ') ? suffix.slice(' — Locked through '.length) : null;
  return { locked_through_date: throughDate, changed_by: timestamps.created_by, changed_at: timestamps.created_at };
}

function ensurePeriodLockEntity(business: BusinessName, ledger: LedgerName, userId: UserId): { id: number; name: string } {
  const ledgerEntity = resolveLedgerEntity(business, ledger);
  if (!ledgerEntity) throw new ValidationError(`No real ledger "${ledger}" under business "${business}".`);
  const lockEntityPrefix = `${business} — ${ledger} — Period Lock`;
  const existing = Entity.children(ledgerEntity.id).find((e) => e.name.startsWith(lockEntityPrefix));
  if (existing) return existing;
  return Entity.create(`${lockEntityPrefix} — Open`, ledgerEntity.id, userId);
}

export function closePeriod(business: BusinessName, ledger: LedgerName, throughDate: string, userId: UserId): void {
  const lockEntity = ensurePeriodLockEntity(business, ledger, userId);
  Entity.rename(lockEntity.id, `${business} — ${ledger} — Period Lock — Locked through ${throughDate}`, userId);
}

export function reopenPeriod(business: BusinessName, ledger: LedgerName, userId: UserId): void {
  const lockEntity = ensurePeriodLockEntity(business, ledger, userId);
  Entity.rename(lockEntity.id, `${business} — ${ledger} — Period Lock — Open`, userId);
}

export function assertPeriodOpen(business: BusinessName, ledger: LedgerName, transdate: string): void {
  const status = getPeriodLockStatus(business, ledger);
  if (status.locked_through_date != null && transdate <= status.locked_through_date) {
    throw new PostingError(
      `This period is closed to normal posting (through ${status.locked_through_date}) — reopen it first if this is a genuine correction.`
    );
  }
}

export function reverseJournalEntry(business: BusinessName, ledger: LedgerName, journalId: number, occurrenceDate: string, userId: UserId, reversalDate?: string): void {
  const original = getJournalEntry(business, ledger, journalId, occurrenceDate);
  if (!original) throw new NotFoundError(`No entry found for journal ${journalId} on ${occurrenceDate}.`);

  const reversalReference = `${original.reference}-REV-${occurrenceDate}`;
  const businessEntity = resolveBusinessEntity(original.business);
  const ledgerEntity = resolveLedgerEntity(original.business, original.ledger);

  const alreadyReversed =
    businessEntity && ledgerEntity
      ? db.prepare(`SELECT 1 FROM journal WHERE reference = ? AND business_id = ? AND ledger_id = ?`).get(reversalReference, businessEntity.id, ledgerEntity.id)
      : undefined;
  if (alreadyReversed) {
    throw new PostingError(`${original.reference} (${occurrenceDate}) has already been reversed — reverse the reversal itself if this needs undoing again.`);
  }

  const date = reversalDate ?? new Date().toISOString().slice(0, 10);

  for (const line of original.lines) {
    stageLine({
      reference: reversalReference,
      business: asBusinessName(original.business),
      ledger: asLedgerName(original.ledger),
      description: `Reversal of ${original.reference} (${occurrenceDate})`,
      transdate: date,
      account: asAccountName(line.account),
      amount_minor: -line.amount_minor,
      memo: line.memo,
    });
  }
  postJournalEntry(reversalReference, asBusinessName(original.business), asLedgerName(original.ledger), userId);

  if (businessEntity && ledgerEntity) {
    db.prepare(`UPDATE journal SET reversal_of = ? WHERE reference = ? AND business_id = ? AND ledger_id = ?`).run(journalId, reversalReference, businessEntity.id, ledgerEntity.id);
  }
}
