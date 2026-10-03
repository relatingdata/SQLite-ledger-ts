## Documentation debt tally

Per direct instruction: every time real documentation is found stale, incomplete, or
simply not yet written — and not fully corrected on the spot — it gets a real,
honest entry here, not silently left for a future rediscovery. Entries are removed
only once actually fixed, not once merely acknowledged.

### Open

1. **`docs/entity-model.md`'s own `createEntity` migration section** — stated "two
   real call sites still use generic `createEntity` directly" (the Entity Tree
   Editor route, and `Entity.create`). Checked directly and found this was already
   stale: `createProvider`, `createEmployee` (`db.ts`), and `primitives.ts`'s own
   `create`/`ensure` helpers also still call it. Being fixed now, alongside the
   real removal of `createEntity` itself - this entry should close once that work
   lands and the section is rewritten to match reality.

2. **Real, remaining `documentation-coverage-baseline.md` gaps** — roughly 66 real,
   exported backend functions/consts (was 168 at the start of tonight's pass) still
   lack a real, direct mention in the manual. Not blocking (`check-docs-coverage`
   treats these as known, tracked, non-regressing gaps), but real, honest,
   remaining debt — not resolved just because it's tracked.

3. **Transactional integrity audit** — `docs/skill-transactional-integrity.md`
   states the requirement and confirms only one real function (`createBusiness`)
   has been brought into compliance so far. 328 real, exported functions exist
   across `db.ts`/`db-stock.ts`/`db-reports.ts`/`auth.ts` alone; the real, full
   audit identifying every real, compound write function still needing this fix
   remains open.

4. **`db-seed.ts`'s own remaining mangled-name references** — `contactsName`/
   `destName` (`${b.name} Contacts`, `${defaultBusiness} Contacts`) still use the
   old, pre-fix, business-prefixed naming pattern in the separate demo-seeding
   path, never migrated when `Contacts` became a plain, per-business-scoped name
   elsewhere tonight. Confirmed harmless to the tutorial e2e (which never loads
   demo data), but a real, further, separate inconsistency, not yet resolved.

5. **`createInvoice`'s own rollback-proof test** — wrapped in a real
   `db.transaction()`, matching `createBusiness`, but no real, deliberately-forced-
   mid-transaction-failure test has been written for it yet, unlike
   `createBusiness`'s own. Every real, obvious failure point (missing business/
   ledger/counterparty, a duplicate reference) is checked *before* the transaction
   opens, by design — genuinely proving the rollback itself needs a real, natural
   trigger that fails *after* the header write but *during* the line-writing loop,
   not yet found and confirmed.

6. **`docs/css-styling-and-data-entry.md`'s own staging-mechanism table was
   stale in a real, serious way** — it listed "Recurring transactions" as a
   real, confirmed stub, when `createRecurringJournal` is actually implemented.
   Found only because this staleness itself hid a real, confirmed, open bug (see
   the entry directly below) — corrected directly, in this same pass, per direct
   instruction that source code must not be consulted again until documentation
   is fully, honestly caught up.

7. **`createRecurringJournal` bypasses `journal_entry_staging` entirely, using a
   currency-blind balance check instead of the real, shared, correct one** — a
   real, confirmed, open bug, documented in full in
   `docs/css-styling-and-data-entry.md` and `docs/screens-staging-triggers-functions.md`,
   directly below/alongside the relevant staging-mechanism tables. Not yet fixed.
   **The real, planned fix, per direct instruction — plan only, not yet
   implemented**:
   1. Replace the function's own, separate `totalAtStart` flat-sum check with a
      real call into `stageLine` for every real line (using each line's own
      real `effective_date` as that staged line's own real `transdate`,
      preserving the exact, same staggered-date behavior this function already
      supports).
   2. Replace the function's own direct `INSERT INTO journal`/`INSERT INTO
      journal_line` calls with a real call to `postJournalEntry`, letting the
      real, shared `post_journal_entry_insert` trigger perform the real,
      correct, per-currency balance check, the real journal/journal_line
      inserts, and the real account-balance updates — exactly as every other,
      real posting path in this system already does.
   3. `postJournalEntry` posts against a fixed, single `transdate` (`NEW.transdate`
      taken from the staged rows) rather than per-line dates directly on the
      `journal` header the way `createRecurringJournal` currently does — the
      real, existing `recurrence`/`recurrenceCount` fields on the `journal`
      table itself are untouched by this change, so this needs a real, direct
      check of how `post_journal_entry_insert` populates `journal.transdate`
      relative to individual `journal_line.effective_date` values, to confirm
      the real, staggered-date behavior survives the switch unchanged before
      this plan is implemented.
   4. Remove the function's own, separate, now-redundant balance check entirely
      once the above is confirmed working, rather than keeping both checks
      running side by side.
   5. Add a real, deliberately-forced-failure test (a recurring entry mixing
      real currencies) proving the *new*, correct per-currency check actually
      rejects it — matching the same, established, rigorous proof pattern as
      `createBusiness`'s and `postInvoice`'s own rollback tests.

**A standing preference, recorded per direct instruction**: when a real
divergence is found between the manual and the live code, the default
resolution — unless explicitly told otherwise for a specific case — is to
correct the *documentation* to accurately describe the code as it currently,
actually behaves, and to record any resulting, real code fix as a *plan* here,
not to implement the code change unprompted.

### Closed

_(moved here, with the checkpoint that closed them, once actually fixed)_

8. **`check-e2e-types` is genuinely broken** — `e2e/tsconfig.json` does not exist,
   so `cd e2e && tsc --noEmit` falls back to printing tsc's own help text instead
   of type-checking anything. A real, pre-existing gap, not introduced tonight,
   found while trying to verify new Playwright code compiled correctly. Not yet
   fixed.
