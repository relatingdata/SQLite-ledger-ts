# Ledger-scoped posting accounts, and the year/period rollover procedure

## The real, confirmed gap, found directly

`account.entity_id` is a single, non-array primary key (`backend/schema/00-core.sql`). `journal_line.account_id REFERENCES account(entity_id)`. Checked directly, both places an `account` row is ever created:

- `account_entry_insert`: `INSERT INTO account (entity_id, ...) VALUES ((SELECT id FROM current_entities WHERE name = NEW.name), ...)`
- `post_journal_entry_insert`'s own lazy creation: `INSERT INTO account (entity_id) SELECT DISTINCT COALESCE(s.account_id, (SELECT id FROM current_entities WHERE name = s.account))`

Both resolve `entity_id` directly to the bare Chart of Accounts leaf (e.g. `Chart of Accounts > Asset > Cash and Bank`) — the same, single entity shared by every ledger of the business. Confirmed directly, `createBusiness` creates each ledger (`create(business, typeLedgerName, actualLedger, userId)`) as a direct child of the business entity — there is no "Ledgers" grouping node at all today, and no per-ledger node for a posting account either.

## The real, correct design

**A real "Ledgers" node, under each business**: `<Business> > Ledgers > <Ledger Name>` (e.g. `Tutorial Wine Retail Business > Ledgers > Actual`). Not yet seeded; `createBusiness` needs to create this intermediate node rather than parenting each ledger directly under the business.

**A real, posting-account node, under its own ledger — not a new mechanism, the existing `parent_id`/`relation_id` convention used correctly**, per `docs/naming-conventions-and-entity-glossary.md`'s own, already-settled rule (`parent_id` is structural — "lives under"; `relation_id` is lateral — "refers to"):

- `parent_id`: this node lives under its own real ledger — `<Business> > Ledgers > <Ledger Name> > <this node>`.
- `relation_id`: points at the real posting leaf in the business's own, adopted Chart of Accounts (e.g. `<Business> > Chart of Accounts > Asset > Cash and Bank`) — which real concept this is an instance of, the same, established relationship `setPrototype`/`getPrototypeOf` already use elsewhere.

**`account.entity_id` points at this ledger-scoped node, never the bare CoA leaf directly.** `journal_line.account_id` follows the same change. This is what makes `account.accountnumber`, `balance_minor`, and `currency` correctly scoped properties of "this account as posted in this specific ledger" — not of the shared CoA concept, which is exactly right: two different ledgers of the same business can carry the same posting concept (`Cash and Bank`) at genuinely different account numbers, balances, and — in principle — even currencies, without any conflict, since each is its own, real, separate entity.

## Why this is the right shape, confirmed directly against a second, independent requirement

`combination_ids`' own, settled design already established the principle this mirrors exactly: a stable reference (`entity_id`, here via `relation_id`) survives a rename of the thing it points at, with zero cascading writes anywhere. The same property is needed here — renaming "Cash and Bank" in the Chart of Accounts must never require rewriting every ledger's own account rows, and it won't, since they only ever hold its `entity_id`.

## The year/period rollover procedure

**The one, absolute rule this procedure never violates: nothing ever posts across ledgers.** A real
journal entry's own `ledger_id` is singular, always — there is no "transfer" primitive, and there
must never be one. Rollover is not one operation that spans two ledgers; it is several entirely
separate, ordinary operations, each scoped to exactly one ledger.

1. **Close the old period's own Income and Expense accounts into the Balance Sheet first** — the
   standard closing entry (`closeBooks`, already built): net profit or loss is posted into Retained
   Earnings, entirely within the old ledger, exactly as today.
2. **Create the new ledger's own `Ledgers` child** (`<Business> > Ledgers > <New Ledger Name>`).
3. **Structural phase — set up the new ledger's own accounts, before any posting at all.** For every
   real, "used" Balance Sheet posting-account node in the old ledger (a genuine non-zero closing
   balance — not every possible Chart of Accounts leaf), create its corresponding node directly
   under the new ledger (`Entity.create` + `Entity.relate` to the same, real Chart of Accounts
   posting leaf the old node pointed at) — a structural, administrative act, never a journal
   entry, and never something left to lazy, implicit creation the way an ordinary posting already
   lazily creates its own account row today. This must happen before step 4 can post anything at
   all, since the accounts it posts against must already exist.
4. **Read phase — compute each one's real, final closing balance in the old ledger.** A plain read
   (the same real mechanism Trial Balance already uses), nothing written anywhere.
5. **Post phase — one real, ordinary, balanced journal entry, entirely within the new ledger.**
   Staged and posted exactly like any other entry in this application, establishing the new ledger's
   own opening balances against the nodes created in step 3 — never referencing the old ledger at
   all.
6. **The business continues trading in the new ledger immediately** — ordinary, ongoing postings go
   against the new ledger's own, now-opened nodes.
7. **The old ledger's own nodes remain exactly as they were, fully postable** — a late-discovered
   adjustment, a correction, an audit finding for the just-closed period still posts entirely within
   the old ledger, preparing the final, true reports for that period, without ever touching the new
   ledger's own, already-ongoing activity.

Income and Expense accounts are **not** carried forward — the new ledger's own Income/Expense nodes
start fresh, at zero, created lazily on first posting exactly as today; only the real, "used"
Balance Sheet accounts carry a real, continuing balance across the rollover, and only via steps 3–5
above, never a direct copy.

## Implementation status — built and directly verified

**Built**: the `Ledgers` grouping node (`createBusiness`, `PER_BUSINESS_ROOTS`); `createLedger`
(`db.ts`) for adding a further real ledger; `findLedgerScopedAccount`/`stageLine` (`db-journal.ts`)
resolving a real, already-existing ledger-scoped node when one exists, falling back to today's bare
CoA-leaf behavior unchanged otherwise — never creating one lazily; `rolloverToNewPeriod`
(`db-reports.ts`), the real, three-phase procedure above, exactly as confirmed; `business_reports`
(`00-core.sql`) fixed to display a ledger-scoped node under its own, real parent account's name,
found by the one, real, narrow test (`relation_id` points at a real ledger entity whose own parent
is literally named `"Ledgers"`) — never a broad "has a child" or "parent is in the walk" test, both
of which were tried and found to incorrectly affect every ordinary account's own category parent
too.

**Directly verified**, against the real `Tutorial Wine Retail Business`, via the real e2e tutorial
(19/19 steps) followed by `closeBooks` → `createLedger` → `rolloverToNewPeriod`:
- The new ledger's own Balance Sheet exactly matches the old ledger's own real closing balances,
  balanced, with correct, real account names (not the ledger's own name, confirmed after finding
  and fixing that exact display bug).
- The old ledger's own Balance Sheet is completely, genuinely unchanged after the rollover —
  confirmed directly, not assumed — proving nothing crossed ledgers.

**Not yet done**: a tutorial step exercising this through the real step-runner/`tutorial-steps.csv`;
a Web UI page for `createLedger`/`rolloverToNewPeriod`; Playwright/UI verification; the
`account_entry_insert`/`post_journal_entry_insert` schema triggers themselves were deliberately left
unchanged — the whole design works without touching them, since `stageLine`'s own pre-resolution of
`accountId` is sufficient.

**A known, confirmed, separate, pre-existing bug, found while verifying this work, not yet
fixed**: `getStockMovementReport` (`backend/src/db-stock.ts`) resolves its own ledger by a bare,
business-unscoped name (`SELECT id FROM current_entities WHERE name = ?`) — confirmed directly, this
silently returns a *different* business's own, same-named ledger's data instead of the real,
intended one, the moment two real businesses genuinely share a ledger name (as "Actual" now
commonly is). Not caused by this chapter's own work, but newly, directly exposed by it.
