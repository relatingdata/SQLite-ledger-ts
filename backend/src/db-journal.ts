// The full, real documentation for every function in this file lives in
// docs/journal-api-reference.md — this file carries no further comments.

import { db } from './db.js';
import { Entity } from './primitives.js';
import {
  ValidationError,
  NotFoundError,
  asUserId,
  asBusinessName,
  asLedgerName,
  asAccountName,
  asDivisionName,
  asProviderName,
  asItemName,
  asLocationName,
  getDivisionType,
  updateEntity,
  deleteEntity,
  getContact,
  setDimensionParent,
  recordInvoiceLine,
  createLocation,
  setLocation,
  ensureLocationCapacityAccount,
  type Location as StockLocation,
  type BusinessName,
  type LedgerName,
  type TypedNode,
  type AccountName,
  type DivisionName,
  type ProviderName,
  type CustomerName,
  type LocationName,
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
  division?: DivisionName;
  bankReference?: string;
}

export function stageLine(line: StagedLine): void {
  if (line.division) {
    const centerType = getDivisionType(line.division);
    if (centerType === 'Cost Center') {
      const category = (
        db.prepare(`SELECT category FROM business_reports WHERE account = ?`).get(line.account) as { category: string } | undefined
      )?.category;
      if (category === 'Income') {
        throw new ValidationError(
          `"${line.division}" is a Cost Center — it applies to purchasing only and cannot be used on an income account like "${line.account}". Use a Profit Center for sales-side postings.`
        );
      }
    }
  }
  db.prepare(
    `INSERT INTO journal_entry_staging (reference, business, ledger, description, transdate, account, account_id, amount_minor, memo, division, bank_reference)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (reference, business, ledger, account, account_id, location, division) DO UPDATE SET amount_minor = excluded.amount_minor, memo = excluded.memo, bank_reference = excluded.bank_reference, account_id = excluded.account_id`
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
    line.division ?? '',
    line.bankReference ?? null
  );
}

export function getStagedLines(reference: string, business: BusinessName, ledger: LedgerName): StagedLine[] {
  return db
    .prepare(
      `SELECT reference, business, ledger, description, transdate, account, amount_minor, memo, division, bank_reference AS bankReference
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
  const totalAtStart = lines.reduce((s, l) => s + (l.effective_date && l.effective_date !== startDate ? 0 : l.amount_minor), 0);
  if (totalAtStart !== 0) {
    throw new PostingError(`This entry does not balance at its start date (off by ${totalAtStart} minor units).`);
  }
  assertPeriodOpen(business, ledger, startDate);

  const businessId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(business) as { id: number } | undefined)?.id;
  const ledgerId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(ledger) as { id: number } | undefined)?.id;
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

  const journalId = db.transaction(() => {
    const info = insertJournal.run(businessId, ledgerId, reference, description ?? '', startDate, userId, recurrence, recurrenceCount ?? null);
    const jid = Number(info.lastInsertRowid);
    for (const line of lines) {
      const acctId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(line.account) as { id: number } | undefined)?.id;
      if (!acctId) throw new ValidationError(`No entity named "${line.account}".`);
      vivify.run(acctId);
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
    setDimensionParent(locationAccount, 'Location', locationName, userId);
  }
  return locationAccount;
}

export interface ARSaleInput {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  customer: CustomerName;
  amount_minor: number;
  tax_minor?: number;
  location?: LocationName;
  transdate?: string;
  description?: string;
}

export function stageARSale(input: ARSaleInput): void {
  db.prepare(
    `INSERT INTO ar_sale_staging (reference, business, ledger, customer, amount_minor, tax_minor, location, transdate, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (reference, business, ledger) DO UPDATE SET
       customer = excluded.customer, amount_minor = excluded.amount_minor, tax_minor = excluded.tax_minor,
       location = excluded.location, transdate = excluded.transdate, description = excluded.description`
  ).run(input.reference, input.business, input.ledger, input.customer, input.amount_minor, input.tax_minor ?? 0, input.location ?? null, input.transdate ?? null, input.description ?? '');
}

export function postARSale(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {
  const staged = db
    .prepare(`SELECT * FROM ar_sale_staging WHERE reference = ? AND business = ? AND ledger = ?`)
    .get(reference, business, ledger) as (ARSaleInput & { tax_minor: number }) | undefined;
  if (!staged) throw new NotFoundError(`Nothing staged for AR sale ${reference}.`);
  if (staged.location) ensureLocationScopedAccount('Sales Revenue', staged.location, userId);
  try {
    db.prepare(`INSERT INTO ar_sale_post (reference, business, ledger, user_id) VALUES (?, ?, ?, ?)`).run(reference, business, ledger, userId);
  } catch (err) {
    throw new PostingError(err instanceof Error ? err.message : String(err));
  }
  recordInvoiceLine(reference, business, ledger, staged.description || 'Sale', null, null, staged.amount_minor, staged.tax_minor);
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
    db.prepare(`INSERT INTO ar_receipt_post (reference, business, ledger, user_id) VALUES (?, ?, ?, ?)`).run(reference, business, ledger, userId);
  } catch (err) {
    throw new PostingError(err instanceof Error ? err.message : String(err));
  }
}

export interface APPurchaseInput {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  vendor: ProviderName;
  expense_account: AccountName;
  amount_minor: number;
  tax_minor?: number;
  location?: LocationName;
  transdate?: string;
  description?: string;
}

export function stageAPPurchase(input: APPurchaseInput): void {
  db.prepare(
    `INSERT INTO ap_purchase_staging (reference, business, ledger, vendor, expense_account, amount_minor, tax_minor, location, transdate, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (reference, business, ledger) DO UPDATE SET
       vendor = excluded.vendor, expense_account = excluded.expense_account, amount_minor = excluded.amount_minor,
       tax_minor = excluded.tax_minor, location = excluded.location, transdate = excluded.transdate, description = excluded.description`
  ).run(
    input.reference, input.business, input.ledger, input.vendor, input.expense_account,
    input.amount_minor, input.tax_minor ?? 0, input.location ?? null, input.transdate ?? null, input.description ?? ''
  );
}

export function postAPPurchase(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {
  const staged = db
    .prepare(`SELECT * FROM ap_purchase_staging WHERE reference = ? AND business = ? AND ledger = ?`)
    .get(reference, business, ledger) as (APPurchaseInput & { tax_minor: number }) | undefined;
  if (!staged) throw new NotFoundError(`Nothing staged for AP purchase ${reference}.`);
  if (staged.location) ensureLocationScopedAccount(staged.expense_account, staged.location, userId);
  try {
    db.prepare(`INSERT INTO ap_purchase_post (reference, business, ledger, user_id) VALUES (?, ?, ?, ?)`).run(reference, business, ledger, userId);
  } catch (err) {
    throw new PostingError(err instanceof Error ? err.message : String(err));
  }
  recordInvoiceLine(reference, business, ledger, staged.description || 'Purchase', null, null, staged.amount_minor, staged.tax_minor);
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
    db.prepare(`INSERT INTO ap_payment_post (reference, business, ledger, user_id) VALUES (?, ?, ?, ?)`).run(reference, business, ledger, userId);
  } catch (err) {
    throw new PostingError(err instanceof Error ? err.message : String(err));
  }
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
  const employee = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(employeeName) as { id: number } | undefined;
  if (!employee) throw new ValidationError(`No employee named "${employeeName}".`);
  const alreadyClocked = db.prepare(`SELECT 1 FROM current_entities WHERE parent_id = ? AND name LIKE 'Clocked In — %'`).get(employee.id);
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

  Entity.create(`Clocked In — ${poReference} — ${projectExpenseAccount} — ${clockedInAt}`, employee.id, userId);
  return { employee: employeeName, po_reference: poReference, project_expense_account: projectExpenseAccount, clocked_in_at: clockedInAt };
}

function getOpenProjectClockEntity(employeeName: string): { id: number; po_reference: string; project_expense_account: string; clocked_in_at: string } | undefined {
  const row = db
    .prepare(
      `SELECT c.id, c.name FROM current_entities c
       JOIN current_entities emp ON emp.id = c.parent_id
       WHERE emp.name = ? AND c.name LIKE 'Clocked In — %'`
    )
    .get(employeeName) as { id: number; name: string } | undefined;
  if (!row) return undefined;
  const [, poReference, projectExpenseAccount, clockedInAt] = row.name.split(' — ');
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

  deleteEntity(open.id, asUserId(1));
}

export function getOpenProjectClockForEmployee(employeeName: EmployeeName): EmployeeClock | undefined {
  const open = getOpenProjectClockEntity(employeeName);
  if (!open) return undefined;
  return { employee: employeeName, po_reference: open.po_reference, project_expense_account: open.project_expense_account, clocked_in_at: open.clocked_in_at };
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
    ensureLocationCapacityAccount(business, asLedgerName('Actual'), asLocationName(staged.location_name), userId);
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

export function postJournalEntry(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {
  try {
    db.prepare(`INSERT INTO post_journal_entry (reference, business, ledger, user_id) VALUES (?, ?, ?, ?)`).run(
      reference,
      business,
      ledger,
      userId
    );
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
  // Per direct correction, matching the Trial Balance's own, already-
  // fixed approach: a real quantity or storage-space posting is a
  // plain, whole count, never a dollar figure divided by 100 - this
  // entry's own real currency (null means the business's home
  // currency) tells the real caller which formatting applies. One
  // real journal entry spanning more than one real currency produces
  // one real row per currency here, never a single, blended total.
  currency: string | null;
}

export function listJournalEntries(business: BusinessName, ledger: LedgerName, limit = 100, offset = 0): JournalSummary[] {
  return db
    .prepare(
      `SELECT jo.journal_id, jo.transdate AS occurrence_date, jo.reference, jo.description,
              biz.name AS business, led.name AS ledger, j.recurrence, COALESCE(u.name, CASE WHEN jo.user_id = 1 THEN 'admin' ELSE NULL END) AS posted_by,
              a.currency AS currency,
              COALESCE(SUM(CASE WHEN jo.amount_minor > 0 THEN jo.amount_minor ELSE 0 END), 0) AS total_debit_minor,
              COALESCE(SUM(CASE WHEN jo.amount_minor < 0 THEN -jo.amount_minor ELSE 0 END), 0) AS total_credit_minor
       FROM journal_occurrences jo
       JOIN journal j ON j.id = jo.journal_id
       JOIN current_entities biz ON biz.id = jo.business_id
       JOIN current_entities led ON led.id = jo.ledger_id
       JOIN account a ON a.entity_id = jo.account_id
       LEFT JOIN current_entities u ON u.id = jo.user_id AND u.parent_id = (SELECT id FROM current_entities WHERE name = 'System Users')
       WHERE biz.name = ? AND led.name = ?
       GROUP BY jo.journal_id, jo.transdate, a.currency
       ORDER BY jo.transdate DESC, jo.journal_id DESC
       LIMIT ? OFFSET ?`
    )
    .all(business, ledger, limit, offset) as JournalSummary[];
}

export function countJournalEntries(business: BusinessName, ledger: LedgerName): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total FROM (
         SELECT 1
         FROM journal_occurrences jo
         JOIN current_entities biz ON biz.id = jo.business_id
         JOIN current_entities led ON led.id = jo.ledger_id
         JOIN account a ON a.entity_id = jo.account_id
         WHERE biz.name = ? AND led.name = ?
         GROUP BY jo.journal_id, jo.transdate, a.currency
       )`
    )
    .get(business, ledger) as { total: number };
  return row.total;
}

export interface JournalDetail extends JournalSummary {
  lines: { account: string; accountnumber: string | null; amount_minor: number; memo: string; division: string | null }[];
}

export function getJournalEntry(business: BusinessName, ledger: LedgerName, journalId: number, occurrenceDate: string): JournalDetail | undefined {
  const header = db
    .prepare(
      `SELECT jo.journal_id, jo.transdate AS occurrence_date, jo.reference, jo.description,
              biz.name AS business, led.name AS ledger, j.recurrence, COALESCE(u.name, CASE WHEN jo.user_id = 1 THEN 'admin' ELSE NULL END) AS posted_by
       FROM journal_occurrences jo
       JOIN journal j ON j.id = jo.journal_id
       JOIN current_entities biz ON biz.id = jo.business_id
       JOIN current_entities led ON led.id = jo.ledger_id
       LEFT JOIN current_entities u ON u.id = jo.user_id AND u.parent_id = (SELECT id FROM current_entities WHERE name = 'System Users')
       WHERE jo.journal_id = ? AND jo.transdate = ? AND biz.name = ? AND led.name = ?
       LIMIT 1`
    )
    .get(journalId, occurrenceDate, business, ledger) as
    | {
        journal_id: number;
        occurrence_date: string;
        reference: string;
        description: string;
        business: string;
        ledger: string;
        recurrence: string;
        posted_by: string;
      }
    | undefined;
  if (!header) return undefined;

  const lines = db
    .prepare(
      `SELECT e.name AS account, a.accountnumber, jo.amount_minor, jo.memo, d.name AS division
       FROM journal_occurrences jo
       JOIN current_entities e ON e.id = jo.account_id
       LEFT JOIN account a ON a.entity_id = e.id
       LEFT JOIN current_entities d ON d.id = jo.division_id
       WHERE jo.journal_id = ? AND jo.transdate = ?`
    )
    .all(journalId, occurrenceDate) as { account: string; accountnumber: string | null; amount_minor: number; memo: string; division: string | null }[];

  const total_debit_minor = lines.filter((l) => l.amount_minor > 0).reduce((s, l) => s + l.amount_minor, 0);
  const total_credit_minor = lines.filter((l) => l.amount_minor < 0).reduce((s, l) => s - l.amount_minor, 0);

  return { ...header, lines, total_debit_minor, total_credit_minor, currency: null };
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
  const row = db
    .prepare(
      `SELECT MIN(j.transdate) AS earliest, MAX(j.transdate) AS latest
       FROM journal j
       WHERE j.ledger_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = ?))
         AND j.reference NOT LIKE 'CLOSE-%'`
    )
    .get(ledgerName, businessName) as { earliest: string | null; latest: string | null };
  return row;
}

export function getPeriodLockStatus(business: BusinessName, ledger: LedgerName): PeriodLockStatus {
  const ledgerEntity = db
    .prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = ?)`)
    .get(ledger, business) as { id: number } | undefined;
  if (!ledgerEntity) return { locked_through_date: null, changed_by: null, changed_at: null };
  const lockEntityPrefix = `${business} — ${ledger} — Period Lock`;
  const row = db
    .prepare(`SELECT name, created_at, created_by FROM current_entities WHERE name LIKE ? AND parent_id = ?`)
    .get(`${lockEntityPrefix}%`, ledgerEntity.id) as { name: string; created_at: string; created_by: number } | undefined;
  if (!row) return { locked_through_date: null, changed_by: null, changed_at: null };
  const suffix = row.name.slice(lockEntityPrefix.length);
  const throughDate = suffix.startsWith(' — Locked through ') ? suffix.slice(' — Locked through '.length) : null;
  return { locked_through_date: throughDate, changed_by: row.created_by, changed_at: row.created_at };
}

function ensurePeriodLockEntity(business: BusinessName, ledger: LedgerName, userId: UserId): { id: number; name: string } {
  const ledgerEntity = db
    .prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = ?)`)
    .get(ledger, business) as { id: number } | undefined;
  if (!ledgerEntity) throw new ValidationError(`No real ledger "${ledger}" under business "${business}".`);
  const lockEntityPrefix = `${business} — ${ledger} — Period Lock`;
  const existing = db
    .prepare(`SELECT id, name FROM current_entities WHERE name LIKE ? AND parent_id = ?`)
    .get(`${lockEntityPrefix}%`, ledgerEntity.id) as { id: number; name: string } | undefined;
  if (existing) return existing;
  return Entity.create(`${lockEntityPrefix} — Open`, ledgerEntity.id, userId);
}

export function closePeriod(business: BusinessName, ledger: LedgerName, throughDate: string, userId: UserId): void {
  const lockEntity = ensurePeriodLockEntity(business, ledger, userId);
  updateEntity(lockEntity.id, { name: `${business} — ${ledger} — Period Lock — Locked through ${throughDate}` }, userId);
}

export function reopenPeriod(business: BusinessName, ledger: LedgerName, userId: UserId): void {
  const lockEntity = ensurePeriodLockEntity(business, ledger, userId);
  updateEntity(lockEntity.id, { name: `${business} — ${ledger} — Period Lock — Open` }, userId);
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

  const alreadyReversed = db
    .prepare(
      `SELECT 1 FROM journal WHERE reference = ? AND business_id = (SELECT id FROM current_entities WHERE name = ?) AND ledger_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = ?))`
    )
    .get(reversalReference, original.business, original.ledger, original.business);
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
      division: line.division ? asDivisionName(line.division) : undefined,
    });
  }
  postJournalEntry(reversalReference, asBusinessName(original.business), asLedgerName(original.ledger), userId);

  db.prepare(
    `UPDATE journal SET reversal_of = ? WHERE reference = ? AND business_id = (SELECT id FROM current_entities WHERE name = ?) AND ledger_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = ?))`
  ).run(journalId, reversalReference, original.business, original.ledger, original.business);
}
