## CSS styling — the real, current state, and the "one, single panel standard"

Per direct, standing request: a real, honest accounting of styling in
this codebase, not an idealized description of how it should work.

### There is genuinely one, real, shared stylesheet

`frontend/src/lib/app.css`, imported once, globally, from the root
layout (`frontend/src/routes/+layout.svelte`). It holds the real,
foundational rules every screen relies on: CSS custom properties for
color (`--paper`, `--paper-dim`, `--ink`, `--ink-soft`, `--rule`,
`--brass-dark`, and a handful more), the real, native `fieldset`/
`legend` reset, and — the single most load-bearing rule in the whole
file — `fieldset.page-title`.

### The one, real, established panel standard

Every real screen in this application is meant to be exactly one,
single, outer `<fieldset class="page-title">`, with its own real name
on the top border (via a real, native `<legend>`) and, when a screen
has real instructions, those instructions in their own, real,
directly-nested, tinted sub-box (`.intro`) — never a separate,
floating element above the panel, and never a second, independent box
below it. This was a real, direct, repeated, hard-won correction
across many rounds this session: multiple screens (Business Setup,
Balance Sheet, Locations, the Configuration landing page, and roughly
forty more) were each found, one at a time, to violate this in a
real, genuine way — a title box holding only the legend and
instructions, with the actual, real content (a list, a form, a report)
sitting in a second, separate box below it. Every one was corrected
to the same, one, real shape: the whole screen's own real content
nested inside the same, single, outer fieldset, including further,
real, legitimately-distinct sub-panels where a screen genuinely has
more than one (Business Setup's tree and detail panes; a Balance
Sheet's own Assets/Liabilities/Equity) — nested inside the one, outer
box, not sitting beside it as separate, independent panels.

```css
fieldset.page-title {
  display: flex;
  flex-direction: column;
  flex: 1;              /* stretches to fill the real, available height */
  width: 100%;           /* stretches to fill the real, available width */
  box-sizing: border-box;
  border: 1px solid var(--rule);
  border-radius: 6px;
  background: var(--paper);
  padding: 0 1.2rem 0.9rem;
  margin: -14px 0 0;      /* a real, deliberate, negative offset — see below */
}

fieldset.page-title:has(> .intro),
fieldset.card-legend:has(> .intro) {
  background: var(--paper-dim);
}
```

The `:has(> .intro)` rule is itself a real, direct fix for a real,
confirmed bug: an earlier version simply gave `fieldset.page-title`
a tinted background unconditionally, which then leaked onto every
real panel sharing that class even when it carried no instructions
at all (Assets/Liabilities/Equity, business-setup's own tree and
detail panes). The tint is now genuinely confined to a panel that
directly, actually contains a real `.intro` child.

The `margin: -14px 0 0` is a real, deliberate correction for a subtle,
native-HTML rendering fact: a `<legend>` genuinely straddles its own
fieldset's top border — sitting half above it, half below — so the
fieldset's own real, *visible* border line sits roughly half the
legend's own height below the element's raw bounding-box top, not
at it. When this panel needs to align with a real, plain, non-fieldset
sibling (the sidebar, `<aside class="sidebar">`, which has no legend
and so has no such offset), the raw bounding-box tops matching is not
enough — the negative margin pulls the *visible* border line up to
where a plain box's real top border would sit. This was found by
direct, live pixel measurement (`getBoundingClientRect()`), not
visual guesswork; a plain visual comparison of two screenshots looked
"close enough" several times before this exact, real cause was
identified.

`fieldset.card-legend` is the same, real pattern's own sibling —
used where a panel's title and its real, direct content (form fields,
a login form, the business/ledger/language picker) are conceptually
one thing from the start, rather than a title merged into an existing,
separate content area after the fact. Structurally identical CSS;
different real-world use.

### `<fieldset>` can never legally hold an interactive ARIA role — a real, confirmed constraint, found directly

A real, confirmed HTML/ARIA fact, found the hard way while making a
keyboard-navigable panel (Insert to add, Delete to remove — the
Business Setup org-chart panel, and `TypedList.svelte`'s own,
identical pattern) genuinely accessible: `<fieldset>` has a fixed,
real, implicit "group" semantic that no explicit `role` can override.
`role="toolbar"` is rejected outright by Svelte's own a11y linter
(`Non-interactive element <fieldset> cannot have interactive role
'toolbar'`); `role="group"` is accepted but is itself redundant
(fieldset already is one) and still leaves the element non-interactive
to the linter, so `tabindex` and a `keydown` handler directly on the
fieldset keep triggering the same warnings. The real, correct fix,
confirmed working and functionally verified afterward (not just for a
clean lint pass): move the interactive semantics — `role="toolbar"`,
`tabindex="0"`, the keydown handler, `aria-describedby` pointing at
the panel's own, already-visible keyboard-hint text, `aria-keyshortcuts`
naming the real keys — onto a plain, inner `<div>` wrapping just the
real list content, leaving the outer `<fieldset>`/`<legend>` purely
for its established visual role (see above). A plain `<div>` has no
fixed implicit role at all, so it can legally take one. Any test
script driving such a panel (`.focus()`, `page.keyboard.press(...)`)
must target this inner element, not the outer fieldset — a real,
confirmed regression found directly when this restructuring landed:
`tutorial-walkthrough.spec.ts`'s own `.tree-panel` focus calls broke
silently until updated to `.tree-panel [role="toolbar"]`.

### One page-scoped `<style>` block per Svelte file — genuinely, not an ORM-style shared component library

The honest state, matching the same, direct answer already given
about backend code reuse: **not as much real, shared reuse as there
should be.** Every `+page.svelte` file carries its own, local `<style>`
block, scoped by Svelte automatically to that one component. A real,
direct audit (not an estimate) found 9 real, shared Svelte components
in `frontend/src/lib/components/` (`AddressList.svelte`,
`PhoneList.svelte`, `ContactPersonList.svelte`, `WeeklyHoursGrid.svelte`,
and a few report-specific ones), used by only 6 of 77 real page files
— and 17 real pages independently re-declaring the exact same
`background: var(--paper)` rule locally, rather than relying on the
global default. This is real, acknowledged, unfinished work, not a
design choice: a genuine consolidation pass (folding page-local
`.card`/`.form`/`.list-card` rules that already just re-state
`fieldset.card-legend`'s own established look into the shared
stylesheet, and removing them from individual pages) has not been
done.

### The top bar's own, real, direct exception

The top navigation bar (`.top-bar`, in `+layout.svelte`) uses the same,
real `fieldset`/`legend` mechanism too — but its own legend is a real,
two-part flex row (`justify-content: space-between`) rather than a
single line of text, so the current user/business/ledger/language
context can sit at the real, left edge while "Change password"/
"Log out" sit at the real, far right — both still genuinely part of
the one, same, native legend, both still genuinely cutting into the
same, one border line, at the same time.

\clearpage

## Data entry screens — the real, established pattern, and a real catalog

### The pattern every real data-entry screen now follows

```svelte
<fieldset class="page-title">
  <legend>{$translations['Screen Name'] ?? 'Screen Name'}</legend>
  <p class="intro">{...real, direct instructions...}</p>

  {#if loading}
    <p>Loading…</p>
  {:else}
    {#if error}<p class="error">{error}</p>{/if}
    {#if message}<p class="success">{message}</p>{/if}

    <!-- the real, direct form fields, or a real, direct list -->

    <button class="btn" on:click={save} disabled={saving}>Save</button>
  {/if}
</fieldset>
```

Every real field group inside is its own, plain, nested `<fieldset>`
(no class needed — the global stylesheet's own, plain `fieldset`
reset already gives it a real border and an embedded legend), not a
`<label>`-wrapped `<input>` — matching the same, one, native
mechanism used for the outer panel itself, all the way down.

### Every real transaction-entry screen, its own backend function, staging table, and trigger

Table: Every real screen that posts a transaction, the real backend function it calls, its own staging table, and the real trigger that turns staged rows into a posted journal entry

| Screen (route) | Backend function | Ends up in `journal_entry_staging`, posted via |
|---|---|---|
| AR Sale (`/arap/ar-sale`) | `postARSale` | `post_journal_entry_insert` |
| AR Receipt (`/arap/ar-receipt`) | `postARReceipt` | `post_journal_entry_insert` |
| AP Purchase (`/arap/ap-purchase`) | `postAPPurchase` | `post_journal_entry_insert` |
| AP Payment (`/arap/ap-payment`) | `postAPPayment` | `post_journal_entry_insert` |
| Cash Sale (`/arap/cash-sale`) | `completePosSale` (no location) | `post_journal_entry_insert` |
| Cash Purchase (`/arap/cash-purchase`) | `completeCashPurchase` | `post_journal_entry_insert` |
| POS Terminal (`/pos`) | `completePosSale` | `post_journal_entry_insert` |
| General Journal (`/post`) | `stageLine` + `postJournalEntry` (direct) | `post_journal_entry_insert` |
| Purchase Order (`/stock/po`) | `postPurchaseOrder` | *(memo only — no ledger effect until fulfilled)* |
| Sales Order (`/stock/so`) | `postSalesOrder` | *(memo only — no ledger effect until fulfilled)* |
| Stock Receipt (`/stock/stock-receipt`) | `postOrderReceipt` | `post_quantity_movement_insert` |
| Stock Dispatch (`/stock/stock-dispatch`) | `postOrderDispatch` | `post_quantity_movement_insert` |
| Stock Transfer (`/stock/transfer`) | `transferItems` | `post_quantity_movement_insert` |
| Stock Take (`/stock/stock-take`) | `completeStockTake` | both triggers — a quantity correction and its own value recognition |
| Write-offs & Expiration (`/stock/write-offs`) | `writeOffItems` | both triggers |
| HR wage payment (`/hr`) | `payEmployeeWages` | `post_journal_entry_insert` |
| Recurring transactions (`/post`, recurring) | `createRecurringJournal` | **none — writes directly to `journal`/`journal_line`, bypassing `journal_entry_staging` entirely** |

A real, direct correction worth stating plainly: every one of these,
financial and quantity-movement alike, genuinely shares the exact,
same `journal_entry_staging` table — there is no second, separate
staging table for stock movements. AR Sale and AP Purchase each stage
into their own, real, screen-specific table first (`ar_sale_staging`,
`ap_purchase_staging`), whose own real trigger (`ar_sale_post_insert`,
`ap_purchase_post_insert`) then inserts into `journal_entry_staging`
in turn — every other screen above stages into `journal_entry_staging`
directly. What
differs after that is only which, real, `INSTEAD OF INSERT` trigger a
screen's own backend function inserts into afterward (`post_journal_entry`
for a real, balanced, double-entry posting; `post_quantity_movement`
for a real, single-line quantity change against one product's own
account) — covered in full in the next section.

**Not included above — real, present routes with no real posting
function yet to document**: Quotations, RFQ,
Assembly/BOM, FX Adjustment, and the three
Voucher screens (`/vouchers/general-ledger`, `/vouchers/payable`,
`/vouchers/payment`) are all real, confirmed stubs today — see Part II
and Part IV for the full, honest accounting of what's stubbed versus
built. (Sales Order, previously listed here in error, is real and
working — corrected directly, confirmed against the live code, per a
direct, reported inconsistency between this section and the earlier
walkthrough describing it as functional.) Recurring transactions,
previously listed here as a stub, is also real and implemented —
corrected directly above, per a real, direct, reported finding: it is
genuinely implemented, but implemented wrongly, bypassing
`journal_entry_staging` and its own real, per-currency balance check
entirely (see the real, confirmed, open bug recorded immediately below
this table).

**A real, confirmed, open bug, found directly and not yet fixed**:
`createRecurringJournal` performs its own, separate balance check — a
flat sum across every real line, with no real currency grouping at
all — instead of using the real, shared, correct per-currency check
`post_journal_entry_insert`'s own trigger enforces for every other,
real posting path. A recurring entry mixing real currencies (for
example, a real debit in USD and a real credit in EUR of the same
minor-unit amount) could pass this flat, incorrect check as
"balanced" while genuinely not being balanced per currency at all.
The real, correct fix is to route `createRecurringJournal` through
the same, real `journal_entry_staging` mechanism every other, real
posting path already correctly uses — `stageLine` already supports a
real, per-line `transdate`, covering this function's own real,
staggered-effective-date need — rather than maintaining a second,
separate, real balance check that can drift out of sync with the one,
real, correct implementation. Not yet fixed as of this writing.

\clearpage

## Staging tables and the triggers behind them — from a typed amount to a posted journal entry

### `journal_entry_staging` — the one, real, shared staging table

```sql
CREATE TABLE journal_entry_staging (
  reference    TEXT NOT NULL,
  business     TEXT NOT NULL,
  ledger       TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  transdate    TEXT,
  account      TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  memo         TEXT NOT NULL DEFAULT '',
  division     TEXT NOT NULL DEFAULT '(none)',
  ...
);
```

A real, direct, temporary holding area — a real backend function
(`completePosSale`, `postJournalEntry`, and every other real posting
function in `db.ts`) inserts one real row per real, individual debit
or credit line here first, all sharing the same real `reference` +
`business` + `ledger` triple, before ever touching a real `journal`/
`journal_line` row at all. Nothing here is itself a real, posted fact
yet — it's genuinely just a real, temporary staging area, keyed so a
real trigger (below) can find every real line belonging to one, same,
real transaction and act on all of them together, atomically, in one,
single `INSERT`.

### `post_journal_entry_insert` — the real trigger behind the General Journal, and everything else that posts a balanced entry

A real, direct `INSTEAD OF INSERT` trigger on a real, otherwise-empty
view (`post_journal_entry`). Every real posting function ends the
same, real way: insert every real line into `journal_entry_staging`,
then `INSERT INTO post_journal_entry (reference, business, ledger,
user_id) VALUES (...)` — a single-row insert that itself carries no
real financial data at all; it's genuinely just the real, direct
signal telling the trigger "everything for this reference is staged,
post it now." The trigger itself, in real, actual order:

1. **Refuses to post nothing.** `RAISE(ABORT, ...)` if no real,
   staged rows exist for this reference/business/ledger at all.
2. **Refuses to post into a closed period.** Checks the real,
   most-recent `period_lock_history` row for this business/ledger;
   aborts if the real, staged transaction date falls on or before the
   real, locked-through date.
3. **Refuses to post an entry that doesn't balance, per real
   currency.** Groups every real, staged line by its own real
   account's own real currency (an account with no explicit currency,
   or one that doesn't exist yet, is its own real group too) and
   aborts if any real group's own real sum isn't genuinely zero. A
   real transaction spanning currencies is allowed — buying EUR with
   USD is one, real entry, two real, independently-balanced currency
   groups — it just can't blend them into one, meaningless, combined
   sum.
4. **Auto-creates any real account that doesn't exist yet** — a real,
   direct `INSERT INTO account (entity_id) SELECT ...` for any staged
   account name genuinely missing one.
5. **Inserts the real `journal` header row** — one, single, real row,
   carrying the real reference, description, transaction date, and
   posting user.
6. **Inserts every real `journal_line` row** — one per real, staged
   line, each referencing the real journal header just inserted.
7. **Updates every real, affected account's own real running
   balance** — a real, direct `UPDATE account SET balance_minor =
   balance_minor + (...)`, summed per real account, in the same,
   single trigger execution.
8. **Deletes the real, now-posted staging rows** — `DELETE FROM
   journal_entry_staging WHERE reference = ... AND business = ... AND
   ledger = ...`, leaving the staging table empty again for the next,
   real transaction.

Every one of these eight real steps happens inside one, single SQLite
trigger body — genuinely atomic; there is no real, intermediate state
where a transaction is half-posted.

### `post_quantity_movement_insert` — the real, deliberately separate sibling

A real, second `INSTEAD OF INSERT` trigger, on its own real,
otherwise-empty view (`post_quantity_movement`), sharing the exact,
same `journal_entry_staging` table, and writing to the exact, same
real `journal`, `journal_line`, and `account` tables — but through its own,
separate trigger, because a real quantity movement (stock received,
dispatched, transferred, written off) is genuinely **not** a
balanced, double-entry transaction: it's a single, real line against
one, specific product's own quantity-tracking account (e.g. "+50
bottles received"), not a debit-here/credit-there relationship
between two, different, real accounts. Requiring it to sum to zero,
the way an ordinary financial entry must, would force inventing a
fake, meaningless offsetting account just to satisfy the check —
genuinely worse for real data integrity, not better. These two,
real, direct triggers are the *only* two real paths that ever write
to `journal`, `journal_line`, and `account` at all; every other, real
posting screen in the application ultimately goes through one or the
other.

### Every other real, `INSTEAD OF INSERT` trigger in the schema

The same, one, real mechanism — a real, otherwise-empty view, backed
by a real, direct trigger that does the actual work — is used
throughout, not just for financial posting:

Table: Every real "INSTEAD OF INSERT" view/trigger pair in the schema, and what its own trigger actually does

| Real view | What its own, real trigger actually does |
|---|---|
| `entity_entry` | Creates a brand-new, real entity |
| `entity_update` | Records a real rename/reparent/relation change (append-only — see "How data actually moves") |
| `entity_delete` | Records a real, direct entity deletion |
| `account_entry` | Sets a real account's own account number/currency |
| `contact_entry` | Sets a real entity's own address/phone/contact-person/payment-terms fields — and, per direct, non-negotiable instruction, a real location's own city/capacity/timezone and a real part's own description/unit/UPC/retail price too, since neither location nor part is a real, separate table any more (see "division, location, and part are genuinely just entities" below) |
| `translation_entry` | Sets a real, direct vocabulary translation |
| `ar_sale_post` / `ar_receipt_post` / `ap_purchase_post` / `ap_payment_post` | Real, direct, purpose-built shortcuts — each stages its own real lines internally, then posts through the exact, same underlying mechanism as `post_journal_entry_insert` |

### Division, location, and part are genuinely just entities — no dedicated table

Per direct, non-negotiable instruction: an entity's own append-only,
self-auditing name/parent/relation record (`entities`) is genuinely
sufficient on its own — a "kind" of entity (a division, a location, a
part) is never a reason to add a separate `CREATE TABLE`. Three real
tables — `division`, `location`, `part` — were introduced this way at
various points in this project's own history (`012bc39`, `7468dab`,
`ceadf56`), each with real, considered reasoning at the time, but each
a real, genuine divergence from this principle. All three have been
removed.

**Where the data actually lives now:**

- A real division's own "kind" (cost vs profit center) — a real,
  named relationship record, `Division Type — {division} → Cost
  Center` or `... → Profit Center`, found by its own predictable name.
  The exact, same, proven mechanism `Belongs To Division` already used.
- A real location's own city, real shelving/floor-area capacity, and
  its own real IANA timezone — genuinely just more, ordinary,
  per-entity data, stored on `contact` (the one, real, established,
  general-purpose table every real party's own details already live
  on), never a dedicated table of its own.
- A real location's own "kind" (retail vs warehouse) and its own
  is-billing-address flag — real, named relationship records
  (`Location Type — {location} → Retail` or `... → Warehouse`, `Is
  Billing Address — {location} → Billing Address`), the identical
  mechanism used for division.
- A real part's own description, unit of measure, UPC, and its own
  current real retail price — likewise just more, ordinary, per-entity
  data on `contact` (prefixed `part_description`, `part_unit_of_measure`,
  `part_upc`, `part_retail_price_minor`, to avoid colliding with
  `contact`'s own, pre-existing columns of a different real purpose).

**Why a named relationship record, not the entity's own `relation_id`
directly:** an entity only ever has one `relation_id` slot. A real,
fine-grained division (e.g. "Riverside Cellars", the division) already
uses its own real location's `relation_id` to record which division it
belongs to (`Belongs To Division`) — so a location's own "kind" tag
cannot also live directly on that same `relation_id` without silently
overwriting it. The named-record mechanism (a real, separate, small
entity whose own name encodes the fact, and whose own `relation_id`
points at the real marker) sidesteps this entirely, at the real cost
of one extra, small entity per tagged fact — confirmed, live, working
correctly for all three real "kind" tags above.

**`part_source` remains a real, genuine, dedicated table** —
deliberately, correctly so: a part sourced from multiple real vendors
is a genuine many-to-many relationship, not 1:1 extension data a
single entity could ever hold on its own.

**`part_location` did not belong, and has been removed** — per direct
correction this same session. Unlike `part_source`'s own genuine
many-to-many relationship, `part_location` was both a real, dedicated
table *and* mutated in place (`UPDATE ... SET quantity_on_hand =
quantity_on_hand ± ?`), violating the entity-only, append-only
principle already established everywhere else in this codebase. A
real (part, location) pair's own real quantity-on-hand is now a
direct `journal_line.location_id`-tagged posting through the exact,
same, already-established `stageQuantityMovementLine`/
`post_quantity_movement` mechanism `Stock Receipt` already, correctly
used — genuinely append-only, with a real, complete, queryable history
of every real movement, not a snapshot silently overwritten each time.
The genuinely separate, configuration-only shelving/capacity data
(min/max/reorder levels, shelf side/rack/level — set-once-read-many,
never append-only ledger data the way quantity itself is) initially
went into structured JSON inside `accountnumber` — a real, second
mistake, corrected the same session, once flagged directly: a JSON
blob in a string field is itself an opaque, non-auditable escape
hatch, exactly as much a violation as a dedicated table, since it
can't be browsed, queried, or audited as real entities the way
everything else in this tree can. The real, correct design: every
real number (min/max/reorder/shelf level) is its own real, direct
account balance, posted through the exact, same, established
mechanism already proven for quantity-on-hand itself; every real
string (shelf side/rack) is a real, direct `setEntityLink` record to
a real, existing, shared Vocabulary entity — no JSON, no dedicated
table, anywhere.

This principle applies to "one entity, one real row of its own
kind-specific data" or "one entity, one real, append-only ledger
posting" — not to genuine, real, multi-row relationships between
entities the way `part_source` still is.

**`menu_section`/`menu_link`/`menu_override` did not belong either,
and have been removed** — the exact, same, real class of mistake as
`part_location`, per direct correction: every real hierarchy and
every real relationship-link type belongs in the self-auditing entity
tree, absolutely nowhere else, with zero exceptions. The real menu is
genuinely just another hierarchy: `Menu` > `Menu Section: X` > `Menu
Link: X — Y`, ordinary entities under `Application`. A real link's
own real target route is a real, direct `setEntityLink` record
pointing at its own, real, shared `Routes` entity (the same shared-
naming shape `Vocabulary` already uses); `notImplemented`/
`isSubheading` are real, presence-only marker child entities (a CoA
prototype tag's own, already-established shape); `requiredRoles` is one
real, direct child entity per real role (the same one-to-many shape
already proven for a contact's own multiple contact types); and
`sort_order` needed no real mechanism at all — `entity_id`'s own real,
natural, append-only creation order already, correctly, is the real
sibling order, since these are seeded in the exact, intended display
order. A real, per-business or per-user override is a real, direct
child entity of the menu item (`"{item} — Override: {scope}
{scopeId}"`), its own real Label linked via `setEntityLink` to a real,
existing Vocabulary word, and a real, presence-only `— Hidden` marker
child when hidden.

\clearpage

## Entity retrieval — the real, core functions everything else is built on

`backend/src/db.ts` holds 59 real, direct, exported `get*` functions
at the time of writing — most genuinely specific (`getAgedInvoices`,
`getCustomerStatement`, `getCashPosition`, and so on), each its own,
real, direct SQL query built for one, particular, real report or
screen. A real, small handful underneath all of them are genuinely
foundational — nearly everything else, directly or indirectly, reads
through one of these:

- **`getEntity(id)`** — the single, most basic, real read: one row
  from `current_entities`, by id. Nearly every other function that
  needs to confirm something real still exists, or fetch its current
  real name/parent, calls this first.
- **`getEntityTree()`** — the real, complete, current entity table,
  walked from its one, real root, in real hierarchy order, each row
  annotated with its own real depth and whether it's a real,
  postable account. The Entity Tree Editor's own, direct data source;
  also the real, underlying data most tree-shaped UI (Business Setup,
  the Structured Editor, Locations) ultimately filters down from
  client-side, rather than each issuing its own, separate, real query.
- **`getRelationship(entityName)`** / **`getEntitiesWithRelationship
  (type)`** — reads a real entity's own `relation_id` link, or finds
  every real entity pointing at a given real relation type. The real,
  generic mechanism behind "Place of Employment," category links, and
  every other real, lateral (non-hierarchical) reference in the
  system.
- **`getContact(entityName)`** — reads the real, shared address/
  phone/payment-terms/language fields any real entity can carry,
  regardless of whether it's a customer, vendor, employee, or
  location. A real, confirmed bug here this session (a missing
  `person_name` column in its own `SELECT` list, despite the
  underlying table, view, and trigger all correctly having it) is a
  real, useful, cautionary example: the schema and the trigger were
  both genuinely correct; only this one, specific, hand-written
  `SELECT` was stale.
- **The real, "typed child entity" prototype** — `getTypedAddresses`,
  `getTypedPhones`, `getTypedContactPersons`, and their own, direct
  `addTyped*`/`deleteTyped*` siblings. Not one, single, generic,
  shared function — each is its own, separate, real implementation,
  independently following the same, established pattern (a real,
  direct child entity, named `{parent} — {type} {Kind}`, carrying its
  own `relation_id` pointing at a real "type" entity) rather than
  genuinely sharing code through one, real, common helper. This is
  the same, honest, acknowledged reuse gap already noted for CSS
  above — a real, direct, proven, repeatable pattern, not yet
  factored into one, real, shared implementation.

Nearly every other, more specific `get*` function in the file is
built by composing these — reading a real entity's own tree position,
its own relation, and its own contact fields, then joining that
against whatever real, additional tables (`journal_line`, `part`,
`account`, and so on) a particular, real report actually needs.
