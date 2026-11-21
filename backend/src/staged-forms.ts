// A transaction form staged before it is posted, held in the backend's
// memory, keyed by its kind, business, ledger and reference.
//
// The design has one staging table, journal_entry_staging, for the general
// journal: every transaction is cooked into general journal lines and
// posted as one entry. A form whose posting needs more than its lines (an
// order's quantity, a receipt's purchase order, a recipe's components) is
// held here between its stage call and its post call, and cooked when it
// is posted. Nothing here is written to the database, and a backend
// restart forgets what was staged and not yet posted.
// Documented in docs/pm-journal-api.md, "Staging".

const staged = new Map<string, unknown>();

const keyOf = (kind: string, business: string, ledger: string, reference: string) => `${kind}\u0000${business}\u0000${ledger}\u0000${reference}`;

/** Stages a form; staging the same reference again replaces it. */
export function stageForm<T>(kind: string, business: string, ledger: string, reference: string, form: T): void {
  staged.set(keyOf(kind, business, ledger, reference), form);
}

/** The staged form, or undefined when nothing was staged. It stays staged
 * until dropStagedForm, so a post that fails can be tried again. */
export function stagedForm<T>(kind: string, business: string, ledger: string, reference: string): T | undefined {
  return staged.get(keyOf(kind, business, ledger, reference)) as T | undefined;
}

/** Removes a staged form once it has been posted. */
export function dropStagedForm(kind: string, business: string, ledger: string, reference: string): void {
  staged.delete(keyOf(kind, business, ledger, reference));
}

/** Every staged form of a kind for a business and ledger, by reference (not removed). */
export function stagedFormsOf<T>(kind: string, business: string, ledger: string): Map<string, T> {
  const prefix = keyOf(kind, business, ledger, '');
  const out = new Map<string, T>();
  for (const [key, form] of staged) if (key.startsWith(prefix)) out.set(key.slice(prefix.length), form as T);
  return out;
}
