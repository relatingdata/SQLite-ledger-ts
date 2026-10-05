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

1. **Close the period's own Income and Expense accounts into the Balance Sheet first** — the standard closing entry: net profit or loss for the period is posted into a real Equity account (Retained Earnings), using the old ledger's own accounts, exactly as today.
2. **Create the new ledger's own `Ledgers` child** (`<Business> > Ledgers > <New Ledger Name>`).
3. **For every real, "used" Balance Sheet posting-account node in the old ledger** (a real Asset/Liability/Equity node with a genuine non-zero closing balance — not every possible Chart of Accounts leaf, only the ones actually posted to) — create a new, separate node under the new ledger, with `relation_id` pointing at the **same** Chart of Accounts posting leaf the old one pointed at, and its own opening `account.balance_minor` set to the old node's real, final closing balance.
4. **The business continues trading in the new ledger immediately** — ordinary, ongoing postings go against the new ledger's own, fresh nodes.
5. **The old ledger's own nodes remain exactly as they were, fully postable** — a late-discovered adjustment, a correction, an audit finding for the just-closed period still posts against the old ledger's own accounts, preparing the final, true reports for that period, without disturbing the new ledger's own, already-ongoing activity in any way.

Income and Expense accounts are **not** carried forward — a new ledger's own Income/Expense nodes start fresh, at zero, created lazily on first posting exactly as today; only the real, "used" Balance Sheet accounts carry a real, continuing balance across the rollover.

## Implementation status

Design only, not yet built: the `Ledgers` grouping node, the ledger-scoped posting-account node convention, the change to `account_entry_insert`/`post_journal_entry_insert`'s own account-resolution logic, and the rollover procedure itself. `createBusiness`, `account_entry_insert`, `post_journal_entry_insert`, and every function resolving `journal_line.account_id` by bare CoA-leaf name are the real, confirmed places this touches. Not yet scoped into an implementation plan with its own testing plan — that is the natural next step once this design itself is confirmed.
