## Documentation debt tally

Per direct instruction: every time real documentation is found stale, incomplete, or
simply not yet written — and not fully corrected on the spot — it gets a real,
honest entry here, not silently left for a future rediscovery. Entries are removed
only once actually fixed, not once merely acknowledged.

### Open

1. **`docs/entity-model.md`'s own `createEntity` migration section** — stated "two
   real call sites still use generic `createEntity` directly" (the Entity Tree
   Editor route, and `Entity.create`). Checked directly and found this was already
   stale: `createVendor`, `createEmployee` (`db.ts`), and `primitives.ts`'s own
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

### Closed

_(moved here, with the checkpoint that closed them, once actually fixed)_
