# Frontend Reference

## How much of Svelte this application actually uses

**Reactivity model.** The application is now predominantly rune-based
(`$state`/`$derived`/`$props`), not legacy-`$:`-exclusive: as of this
writing, 54 of 102 `.svelte` files use runes (`grep -rl
'\$state(\|\$derived(\|\$props(' frontend/src --include="*.svelte"`).
Re-run that grep rather than trusting this count — the migration is
ongoing (see `docs/svelte-5-runes-migration-plan.md` for current,
file-by-file status).

**Shared, cross-component state** uses Svelte's own plain
`writable`/`derived` stores (`svelte/store`), one small, focused file
per concern under `frontend/src/lib/` (`session.ts`, `auth.ts`,
`menu.ts`, `translations.ts`, `dirty-state.ts`) — a component reads a
store's current value with the `$` prefix (`$session`,
`$translations`). No separate, larger state-management library (no
Redux-style pattern, no single all-in-one store).

**Components.** The overwhelming majority of screens are a single,
direct `+page.svelte` file — markup, inline `<style>`, and
`<script>`, all in one file, rather than composed from many small
components. A genuinely reusable piece (`AddressList.svelte`,
`PhoneList.svelte`, the recursive `HierarchyGroupPLNode.svelte`) exists
where the same shape is genuinely needed in more than one place — the
exception, not the default.

**External dependencies.** Exactly one, beyond Svelte/SvelteKit
themselves: `@keenmate/svelte-treeview`, for the Entity Tree page's
generic, recursive tree render. No broader UI component kit or
design-system library anywhere else — every other button, table,
form, and card is plain, hand-written HTML/CSS.

## CSS: one shared stylesheet, one panel standard

`frontend/src/lib/app.css`, imported once, globally, from the root
layout (`frontend/src/routes/+layout.svelte`). Holds the CSS custom
properties for color (`--paper`, `--paper-dim`, `--ink`, `--ink-soft`,
`--rule`, `--brass-dark`, and a few more), the native `fieldset`/
`legend` reset, and the single most load-bearing rule in the file,
`fieldset.page-title`.

**Every screen is exactly one, single, outer `<fieldset
class="page-title">`**, with its own name on the top border (a native
`<legend>`) and, when a screen has instructions, those instructions in
a directly-nested, tinted sub-box (`.intro`) — never a separate,
floating element above the panel, never a second, independent box
below it. Further, legitimately-distinct sub-panels a screen may need
(Business Setup's tree and detail panes; a Balance Sheet's own
Assets/Liabilities/Equity) nest *inside* the one outer box, never
beside it as separate panels.

```css
fieldset.page-title {
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--rule);
  border-radius: 6px;
  background: var(--paper);
  padding: 0 1.2rem 0.9rem;
  margin: -14px 0 0;      /* see below */
}

fieldset.page-title:has(> .intro),
fieldset.card-legend:has(> .intro) {
  background: var(--paper-dim);
}
```

`:has(> .intro)` confines the tinted background to a panel that
actually contains an `.intro` child (an earlier, unconditional version
leaked the tint onto every panel sharing the class, including ones
with no instructions). The `margin: -14px 0 0` corrects for a native
HTML rendering fact: a `<legend>` straddles its own fieldset's top
border (half above, half below), so the fieldset's visible border
line sits below its raw bounding-box top — the negative margin pulls
the visible border up to align with a plain, non-fieldset sibling
(e.g. `<aside class="sidebar">`) that has no such offset.

`fieldset.card-legend` is the same pattern's sibling, used where a
panel's title and its direct content (a login form, a picker) are
conceptually one thing from the start, rather than a title merged into
an existing content area afterward.

**`<fieldset>` can never legally carry an interactive ARIA role** —
its fixed, implicit "group" semantic can't be overridden
(`role="toolbar"` is rejected outright by Svelte's a11y linter;
`role="group"` is redundant and still non-interactive to the linter).
The fix: move interactive semantics (`role="toolbar"`, `tabindex="0"`,
the keydown handler, `aria-describedby`, `aria-keyshortcuts`) onto a
plain, inner `<div>` wrapping just the list content, leaving the outer
`<fieldset>`/`<legend>` purely for its visual role. A test script
driving such a panel must target this inner element (e.g.
`.tree-panel [role="toolbar"]`), not the outer fieldset.

**Reuse is genuinely incomplete, acknowledged rather than hidden**:
each `+page.svelte` carries its own local `<style>` block; roughly 15
shared components exist in `frontend/src/lib/components/` against ~83
page files, and a number of pages re-declare rules (e.g. `background:
var(--paper)`) that a global default already covers. A consolidation
pass (folding page-local `.card`/`.form`/`.list-card` rules that
already just restate `fieldset.card-legend` into the shared
stylesheet) has not been done. Re-run `ls
frontend/src/lib/components/*.svelte | wc -l` /
`find frontend/src/routes -name "+page.svelte" | wc -l` rather than
trusting a specific count here.

**The top bar** (`.top-bar`, in `+layout.svelte`) uses the same
`fieldset`/`legend` mechanism, with a two-part flex row
(`justify-content: space-between`) so the current user/business/
ledger/language context sits at the left edge while "Change
password"/"Log out" sit at the right — both still genuinely part of
the one, same native legend.

## The data-entry screen pattern

```svelte
<fieldset class="page-title">
  <legend>{$translations['Screen Name'] ?? 'Screen Name'}</legend>
  <p class="intro">{...instructions...}</p>

  {#if loading}
    <p>Loading…</p>
  {:else}
    {#if error}<p class="error">{error}</p>{/if}
    {#if message}<p class="success">{message}</p>{/if}
    <!-- fields or list -->
    <button class="btn" on:click={save} disabled={saving}>Save</button>
  {/if}
</fieldset>
```

Every field group inside is its own plain, nested `<fieldset>` (no
class needed — the global stylesheet's plain `fieldset` reset already
gives it a border and embedded legend), never a `<label>`-wrapped
`<input>` — the same native mechanism as the outer panel, all the way
down.

### Every transaction-posting screen, its backend function, and how it posts

| Screen (route) | Backend function | Posts via |
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
| Stock Take (`/stock/stock-take`) | `completeStockTake` | both triggers |
| Write-offs & Expiration (`/stock/write-offs`) | `writeOffItems` | both triggers |
| HR wage payment (`/hr`) | `payEmployeeWages` | `post_journal_entry_insert` |
| Recurring transactions (`/post`, recurring) | `createRecurringJournal` | **none — writes directly, bypassing staging (known gap, see Journal API chapter)** |

Every one of these, financial and quantity-movement alike, shares the
exact same `journal_entry_staging` table — there is no second staging
table for stock movements. AR Sale/AP Purchase stage into their own
screen-specific table first (`ar_sale_staging`, `ap_purchase_staging`),
whose own trigger then inserts into `journal_entry_staging` in turn;
every other screen stages into it directly.

**Not yet built**: Quotations, RFQ, Assembly/BOM management UI, FX
Adjustment, and the three Voucher screens
(`/vouchers/general-ledger`, `/vouchers/payable`, `/vouchers/payment`)
are confirmed stubs — see the screens table below for the full,
current, generated list.

## Screens inventory (generated — regenerate via `make screens-inventory`)

Every frontend route, source file, code/comment line count, and
whether it's implemented, a thin wrapper around a shared component, or
still a stub. Generated directly from source by
`scripts/generate-screens-inventory.ts` — never hand-edited; re-run
rather than trusting this copy once the application has grown further.

| Route | Source File | Code Lines | Comment Lines | Status |
|---|---|---|---|---|
| / | frontend/src/routes/+page.svelte | 27 | 0 | Implemented |
| /account/password | frontend/src/routes/account/password/+page.svelte | 89 | 0 | Implemented |
| /arap | frontend/src/routes/arap/+page.svelte | 47 | 0 | Implemented |
| /arap/ap-payment | frontend/src/routes/arap/ap-payment/+page.svelte | 4 | 0 | Thin wrapper (shared component) |
| /arap/ap-purchase | frontend/src/routes/arap/ap-purchase/+page.svelte | 280 | 6 | Implemented |
| /arap/ar-receipt | frontend/src/routes/arap/ar-receipt/+page.svelte | 4 | 0 | Thin wrapper (shared component) |
| /arap/ar-sale | frontend/src/routes/arap/ar-sale/+page.svelte | 301 | 9 | Implemented |
| /arap/cash-purchase | frontend/src/routes/arap/cash-purchase/+page.svelte | 4 | 0 | Thin wrapper (shared component) |
| /arap/cash-sale | frontend/src/routes/arap/cash-sale/+page.svelte | 4 | 0 | Thin wrapper (shared component) |
| /arap/quotations | frontend/src/routes/arap/quotations/+page.svelte | 7 | 0 | Not implemented |
| /arap/rfq | frontend/src/routes/arap/rfq/+page.svelte | 7 | 0 | Not implemented |
| /cash | frontend/src/routes/cash/+page.svelte | 7 | 0 | Not implemented |
| /contacts | frontend/src/routes/contacts/+page.svelte | 454 | 27 | Implemented |
| /customer-terminal | frontend/src/routes/customer-terminal/+page.svelte | 120 | 1 | Implemented |
| /editor | frontend/src/routes/editor/+page.svelte | 408 | 60 | Implemented |
| /exchange-rates | frontend/src/routes/exchange-rates/+page.svelte | 7 | 0 | Not implemented |
| /gl/fx-adjustment | frontend/src/routes/gl/fx-adjustment/+page.svelte | 7 | 0 | Not implemented |
| /goods-services | frontend/src/routes/goods-services/+page.svelte | 7 | 0 | Not implemented |
| /hr | frontend/src/routes/hr/+page.svelte | 317 | 0 | Implemented |
| /invoices | frontend/src/routes/invoices/+page.svelte | 652 | 4 | Implemented |
| /items | frontend/src/routes/items/+page.svelte | 658 | 46 | Implemented |
| /jobs | frontend/src/routes/jobs/+page.svelte | 7 | 0 | Not implemented |
| /journal | frontend/src/routes/journal/+page.svelte | 72 | 0 | Implemented |
| /journal/[id]/[date] | frontend/src/routes/journal/[id]/[date]/+page.svelte | 119 | 0 | Implemented |
| /locations | frontend/src/routes/locations/+page.svelte | 680 | 37 | Implemented |
| /login | frontend/src/routes/login/+page.svelte | 127 | 20 | Implemented |
| /logistics/assembly-bom | frontend/src/routes/logistics/assembly-bom/+page.svelte | 7 | 0 | Not implemented |
| /order-entry/generate-invoices | frontend/src/routes/order-entry/generate-invoices/+page.svelte | 7 | 0 | Not implemented |
| /order-entry/generate-po | frontend/src/routes/order-entry/generate-po/+page.svelte | 7 | 0 | Not implemented |
| /pos | frontend/src/routes/pos/+page.svelte | 515 | 21 | Implemented |
| /post | frontend/src/routes/post/+page.svelte | 427 | 28 | Implemented |
| /projects | frontend/src/routes/projects/+page.svelte | 151 | 0 | Implemented |
| /reconciliation | frontend/src/routes/reconciliation/+page.svelte | 7 | 0 | Not implemented |
| /recurring | frontend/src/routes/recurring/+page.svelte | 7 | 0 | Not implemented |
| /reports | frontend/src/routes/reports/+page.svelte | 55 | 0 | Implemented |
| /reports/aged | frontend/src/routes/reports/aged/+page.svelte | 160 | 0 | Implemented |
| /reports/balance-sheet | frontend/src/routes/reports/balance-sheet/+page.svelte | 279 | 36 | Implemented |
| /reports/below-reorder | frontend/src/routes/reports/below-reorder/+page.svelte | 77 | 0 | Implemented |
| /reports/business-configuration | frontend/src/routes/reports/business-configuration/+page.svelte | 128 | 0 | Implemented |
| /reports/cash-flow-forecast | frontend/src/routes/reports/cash-flow-forecast/+page.svelte | 214 | 0 | Implemented |
| /reports/compare | frontend/src/routes/reports/compare/+page.svelte | 195 | 11 | Implemented |
| /reports/new-new-pl | frontend/src/routes/reports/new-new-pl/+page.svelte | 228 | 38 | Implemented |
| /reports/new-pl | frontend/src/routes/reports/new-pl/+page.svelte | 258 | 9 | Implemented |
| /reports/new-stock-on-hand | frontend/src/routes/reports/new-stock-on-hand/+page.svelte | 238 | 0 | Implemented |
| /reports/old-pl | frontend/src/routes/reports/old-pl/+page.svelte | 215 | 14 | Implemented |
| /reports/pl-pivot | frontend/src/routes/reports/pl-pivot/+page.svelte | 307 | 17 | Implemented |
| /reports/profit-and-loss | frontend/src/routes/reports/profit-and-loss/+page.svelte | 228 | 38 | Implemented |
| /reports/reminders | frontend/src/routes/reports/reminders/+page.svelte | 145 | 0 | Implemented |
| /reports/sales | frontend/src/routes/reports/sales/+page.svelte | 188 | 3 | Implemented |
| /reports/statement | frontend/src/routes/reports/statement/+page.svelte | 207 | 9 | Implemented |
| /reports/stock-movement | frontend/src/routes/reports/stock-movement/+page.svelte | 250 | 6 | Implemented |
| /reports/stock-out-risk | frontend/src/routes/reports/stock-out-risk/+page.svelte | 77 | 0 | Implemented |
| /reports/trial-balance | frontend/src/routes/reports/trial-balance/+page.svelte | 147 | 1 | Implemented |
| /session | frontend/src/routes/session/+page.svelte | 181 | 7 | Implemented |
| /setup | frontend/src/routes/setup/+page.svelte | 129 | 1 | Implemented |
| /setup/bank-accounts | frontend/src/routes/setup/bank-accounts/+page.svelte | 224 | 0 | Implemented |
| /setup/business-setup | frontend/src/routes/setup/business-setup/+page.svelte | 644 | 26 | Implemented |
| /setup/chart-of-accounts | frontend/src/routes/setup/chart-of-accounts/+page.svelte | 269 | 9 | Implemented |
| /setup/currencies | frontend/src/routes/setup/currencies/+page.svelte | 7 | 0 | Not implemented |
| /setup/hierarchy | frontend/src/routes/setup/hierarchy/+page.svelte | 261 | 4 | Implemented |
| /setup/new-business | frontend/src/routes/setup/new-business/+page.svelte | 429 | 42 | Implemented |
| /setup/periods | frontend/src/routes/setup/periods/+page.svelte | 152 | 0 | Implemented |
| /setup/taxes | frontend/src/routes/setup/taxes/+page.svelte | 7 | 0 | Not implemented |
| /setup/translations | frontend/src/routes/setup/translations/+page.svelte | 242 | 9 | Implemented |
| /setup/tree | frontend/src/routes/setup/tree/+page.svelte | 87 | 0 | Implemented |
| /setup/users | frontend/src/routes/setup/users/+page.svelte | 164 | 0 | Implemented |
| /setup/vocabulary | frontend/src/routes/setup/vocabulary/+page.svelte | 130 | 24 | Implemented |
| /setup/yearend | frontend/src/routes/setup/yearend/+page.svelte | 287 | 0 | Implemented |
| /shipping | frontend/src/routes/shipping/+page.svelte | 7 | 0 | Not implemented |
| /stock | frontend/src/routes/stock/+page.svelte | 47 | 0 | Implemented |
| /stock/listing | frontend/src/routes/stock/listing/+page.svelte | 240 | 8 | Implemented |
| /stock/po | frontend/src/routes/stock/po/+page.svelte | 229 | 18 | Implemented |
| /stock/restock | frontend/src/routes/stock/restock/+page.svelte | 285 | 13 | Implemented |
| /stock/so | frontend/src/routes/stock/so/+page.svelte | 168 | 0 | Implemented |
| /stock/stock-dispatch | frontend/src/routes/stock/stock-dispatch/+page.svelte | 251 | 1 | Implemented |
| /stock/stock-receipt | frontend/src/routes/stock/stock-receipt/+page.svelte | 238 | 1 | Implemented |
| /stock/stock-take | frontend/src/routes/stock/stock-take/+page.svelte | 215 | 2 | Implemented |
| /stock/transfer | frontend/src/routes/stock/transfer/+page.svelte | 107 | 4 | Implemented |
| /stock/write-offs | frontend/src/routes/stock/write-offs/+page.svelte | 288 | 2 | Implemented |
| /vouchers/general-ledger | frontend/src/routes/vouchers/general-ledger/+page.svelte | 7 | 0 | Not implemented |
| /vouchers/payable | frontend/src/routes/vouchers/payable/+page.svelte | 7 | 0 | Not implemented |
| /vouchers/payment | frontend/src/routes/vouchers/payment/+page.svelte | 7 | 0 | Not implemented |

**82 screens total** — 60 implemented, 4 thin wrapper (shared
component), 18 not yet implemented.

## `frontend/src/lib/api.ts` — the request wrapper and its design notes

Every backend call goes through one private `request<T>(path, init,
screenName?)` helper: attaches the bearer token from `auth.current` as
`Authorization: Bearer <token>`, attaches an optional `X-Screen-Name`
header (consumed by the backend's Admin recording feature — see the
Testing: E2E chapter), throws a typed `ApiError` on a non-2xx response
(reading `body.error?.message` when present) or on a network failure
(backend unreachable), clears the stored session on a `401`, and
returns `undefined` for a `204`. No other file constructs a raw
`fetch` against the backend except `exportInvoiceAsEInvoice` (needs
the raw XML text, not JSON).

**Branded types are re-declared here, not imported.** The frontend and
backend are separate TypeScript projects with no shared types package,
so `BusinessName`/`LedgerName`/`AccountName`/etc. (mirroring the
backend's own system — see "Branded (nominal) types" in the Entity
Model chapter) are declared independently on each side, with their own
`asXxxName()` functions as the one explicit boundary where an ordinary
string becomes branded.

**`checkVersion()`** compares the frontend's own build-time
`__APP_VERSION__` against the backend's live-reported version
(`compareVersions`, a proper numeric dot-separated comparison, never a
lexical string compare — `"0.0.0.99" > "0.0.0.100"` lexically but not
numerically). Whichever side is older is out of date: the frontend
reloads itself fully; the backend can't be restarted from here, so a
console warning is the most this call can do.

**The "pass the resolved account id, not just the bare name" rule.**
Two different accounts can share the exact same literal name (e.g.
Open Container's own "Remaining"/"Occupied" leaves, repeated once per
combination) — staging by bare name alone is then ambiguous. Wherever
the backend has already resolved a specific account id (`StagedLine`'s
own optional `accountId`, `CloseBooksPreview`'s per-line `accountId`,
Storage Capacity's "Remaining"/"Occupied" accounts), the frontend
carries that id through rather than re-staging by name — the same
convention `findLedgerScopedAccount` enforces on the backend side (see
the Journal API chapter).

**The "frontend-driven canned journal" pattern.** A number of screens
(Open Container, Receive Into Storage, Stock Transfer, Cash Purchase,
POS Sale, Close Books, Rollover) post their own journal entries
directly from the frontend via the ordinary `stageLine`/
`postJournalEntry` calls, rather than one backend endpoint doing the
whole thing server-side. In this pattern the backend exposes two
narrower kinds of endpoint instead of one wide one:

- **A `resolve*Accounts` endpoint** (`resolveOpenContainerAccounts`,
  `resolveReceiveAccounts`, `resolveTransferAccounts`,
  `resolveCashTransactionAccounts`, `resolveSaleAccounts`,
  `resolveRolloverLines`) — a read-only, stateless call that resolves
  or creates whichever accounts the frontend will need to stage lines
  against (including each item's own known per-unit cost), but posts
  nothing itself.
- **A narrow, physical-only endpoint** (`receiveIntoStorageStock`,
  `transferStock`, `receiveStock`, `dispatchStock`) — does only the
  real, physical side effect (a quantity movement, a location-capacity
  change), with no journal entry of its own; the frontend posts the
  dollar-value entry itself, separately, using the resolved accounts.

The frontend is responsible for sequencing these two calls correctly
and for actually posting the resulting lines; the backend never
assembles the combined entry on the caller's behalf in this pattern.
Contrast with `completePosSale`, `completeCashPurchase`,
`createLocation`, and most other calls, which remain single, atomic,
server-side operations the frontend simply awaits in full.

**Other load-bearing, function-specific notes**, kept brief since
their rationale lives in the cited chapter:

- `createProvider`/`createCustomer`/`createEmployeeContact` tag the new
  entity with a real Contact Type immediately, never leaving it to
  structural parent alone.
- `saveLocation` (unlike `createLocation`) didn't originally pass a
  `business` query parameter, so the backend's bare-name lookup could
  land on the wrong, same-named entity once a location's own "Storage"
  account root shares its literal name — fixed to always scope by
  business, matching `createLocation`.
- `getActiveLedger`/`getProfitCenters`/`createProfitCenter`/
  `setSessionProfitCenter` back the Session screen's ledger/Profit
  Center pickers (Profit Center not yet wired to that screen — still
  client-side-only there, like Business/Ledger).
- `getUserRoleMatrix`/`setUserRoleInBusiness` is a genuine per-business
  User × Role Cartesian Product, additive alongside the older, global
  `getUsers`/`setUserRolesApi`.
- `ItemSourceInput.currency`: `null` means the business's own home
  currency; a non-null value is a separate, independently-priced row
  for the same item/vendor pair, never a currency conversion.
- `listItems` requires `business` explicitly (items are scoped per
  business, the same convention `listLocations` follows) — never an
  optional afterthought.
- `convertStorageSpace`/`openStorageContainer` reuse the same
  Hierarchy/Product Cartesian mechanism already built for wine
  combinations and currency pairs — no separate setup screen; both
  draw on `/setup/hierarchy` directly.
- `LocationInput.timezone` is a real IANA identifier, required, since
  a location's transactions record against that location's own local
  calendar day (see `todayAtLocation` in the Stock API chapter).
- `getLocationCurrencies`/`nominateLocationCurrency`: a location's own
  nominated set of further trading currencies — nearly every location
  returns an empty array.
- `getStorageSpaceReport`: Storage Capacity accounts live under each
  Location, structurally outside Chart of Accounts, so the Trial
  Balance never shows them — this report reads them directly, grouped
  by location and storage-unit currency (`SPACE-CARTON`,
  `SPACE-BOTTLE`).

A handful of `// UNUSED (checkpoint N)` commented-out exports remain
in the file (not deleted, per this project's own "recoverable, not
silently discarded" convention) — see `docs/unused-functions.md` for
the full, current list; they are not reproduced here since that file
is itself the live-maintained record of this specific fact.

## `frontend/src/lib/canned-journal.ts` — the canned-journal computation module

This is the one, shared, non-duplicated module every "canned"
financial screen's submit handler calls to build its own complete,
already-balanced set of journal lines, then posts them through the
same `stageLine`/`postJournalEntry` calls the General Journal screen's
own "Save" button uses — the frontend half of the "frontend-driven
canned journal" pattern described under the `api.ts` section above.
Each function here is a pure, deterministic computation over the
screen's own form values plus whatever account names the backend has
already resolved for it (via a `resolve*Accounts` call) — it never
creates an account, never touches stock quantities, and never calls
the network itself.

**No division/category field, ever.** A journal entry never carries a
division or category of any kind — every real dimension (which
location, which item, which storage tier/pack size) is baked directly
into the account's own name, the Location × Item Cartesian product
(× storage tier/pack size where that distinction genuinely changes
cost or selling price), the same way `ensureItemLocationInventoryAccount`
names its own accounts (`<item> (<tier>) — <location>`). There is no
separate tag field anywhere in this module, and there must never be
one.

`CannedLine.accountId` carries the same resolved-id-over-bare-name
rationale as `StagedLine.accountId` (see the "pass the resolved
account id" rule under `api.ts`, above) — repeated here only as a
reminder at the point of use, not re-explained.

The five per-screen canned shapes:

- **`cashPurchaseLines`** (Cash Purchase) — debits each item's
  location-scoped Inventory account (resolved by
  `resolveCashTransactionAccounts`) for that line's amount, debits the
  tax account for the total tax if any, and credits Cash-and-Bank for
  the grand total. Mirrors what `completeCashPurchase`/`postInvoice`
  compute server-side.
- **`posSaleLines`** (Cash Sale) — mirrors `completePosSale`'s own
  revenue-account resolver and COGS loop, but split into two separate
  results since the backend always posted these as two separate
  journal entries: the main sale entry (credit Sales Revenue per item,
  credit tax, debit Cash-and-Bank) and a COGS-only entry, posted only
  for lines whose per-unit cost is actually known (debit COGS, credit
  Inventory). A new product with no known cost yet simply posts no
  COGS/Inventory line — never a fabricated cost.
- **`transferLines`** (Stock Transfer) — credits the source location's
  Inventory account and debits the destination's, for the real cost
  of the quantity moved. Returns an empty line list when the item's
  per-unit cost isn't known yet (no fabricated cost, no entry at all —
  only the physical movement via `transferStock` happens).
- **`openContainerLines`** (Open Container) — returns two independent
  results, since they're posted as two separate journal entries: the
  storage-space movement (container's "Remaining" up / "Occupied" down
  by `cartonsOpened`; unit's "Remaining" down / "Occupied" up by
  `unitsProduced`; no contra accounting) always posts, while the
  dollar Inventory-value movement (container tier's Inventory account
  to the unit tier's) posts only when the per-unit cost is known.
- **`receiveIntoStorageLines`** (Receive Into Storage) — relevant only
  for a combination-tracked receipt (an ordinary receipt posts no
  dollar journal entry at all): debits the item's combination-tier
  Inventory account, credits Accounts Payable, for the real cost of
  the quantity received. Returns an empty line list when no
  combination was given, or cost isn't known yet.

**`freshReference`** generates a client-side reference in the same
`<PREFIX>-<timestamp>-<random>` shape the backend's own canned
functions used to generate server-side.

## `frontend/src/routes/editor/+page.svelte` — the generic entity editor

**`entitiesById`** is a memoized `id → entity` Map, built once per
entities load. This fixes a real performance bug found live by timing
the UI: the "Create Provider"/"Create Customer" step consistently took
~18s even though every network call finished in well under 300ms — the
entities table renders every entity in the whole business (4,623 of
them in the real seed data) as a row, and each row calls `nameFor`
twice (parent name, relation name); `nameFor` previously did a linear
`entities.find(...)` scan on every one of those ~9,246 calls. The same
class of bug (and the same O(1)-map fix) recurred twice elsewhere this
project — see `/items`'s `categories` block and `entityTree.ts`.

**`parentableEntities`** filters Vocabulary and its descendants
(translated UI labels, help text) out of the parent/relation picker,
since once help-text vocabulary entities became sentence-length the
dropdown became cluttered with hundreds of unreadable options. This
filters the dropdown only, not the underlying entity list used by the
table view above. Critically, it excludes only Vocabulary's own
*childless* direct children, not the whole subtree: "Customers" lives
structurally under Vocabulary (`Customers < Vocabulary < Application <
Root`), the same place every leaf UI-label word and help-text sentence
lives — excluding the whole subtree unconditionally (an earlier
version) silently removed "Customers" as a legitimate, selectable
Parent target along with the leaf words. The distinguishing signal,
confirmed against real seed data: of Vocabulary's 742 direct children,
only 14 — exactly the structural category roots real business
entities get created under (`Customers`, `Vendors`, `Relationship
Types`, `Address Types`, `Contact Person Types`, and similar) — have
any children of their own anywhere in the tree; every pure leaf
UI-label word and help-text sentence has none.

**The re-parent guard rail** (`originalParent`/`originalName`/
`originalRelation`/`originalAccountnumber`, §5 of
`docs/translator-form-and-guard-rails-plan.md`) records the entity's
state at selection time, compared against the edit fields at save
time, so a structural re-parent — as opposed to an ordinary rename or
relation change — always gets its own explicit confirmation showing
both the current and proposed parent together. This is the exact
guard rail that would have caught an accidental attempt elsewhere in
this project to re-parent Customers under Accounts Receivable before
it was ever written to `schema.sql`.

This page also opts into the shared Esc-with-warning mechanism
(`$lib/dirty-state` / `hasUnsavedEdit` — see the State chapter above).
**`contact`** holds only the fields that still live directly on the
contact record; address/phone are handled entirely by the shared
`AddressList`/`PhoneList` components. **`hierarchyLinksIn`** is a
second guard rail (§5): every entity that reaches the currently
selected one via a hierarchy link, so the editor shows a visible
"why is this here" trail rather than requiring a structural link to
be discovered by accident.

**`normalizeForDuplicateCheck`** backs a live, pre-creation
duplicate-intent check (§5) — case-insensitive, and also flagging a
close, likely-typo match (same name differing only in
whitespace/punctuation), not only an exact one, since this app's
global-uniqueness rule makes near-misses just as real a trap as exact
duplicates. The create-vendor path specifically (per
`docs/contact-types-and-translations.md`) routes through
`createProvider` rather than a generic structural parent, so a new
vendor is genuinely tagged with its own Contact Type, not just
structurally parented. `setContact` always sends the complete current
form state — it's a full replace, not a partial merge (see
`schema.sql`'s note on `contact_entry`) — so a partial send would
silently wipe whatever field isn't included.

## `frontend/src/routes/+layout.svelte` — the app shell: menu, sections, keyboard nav, clock

**Menu structure** comes from `getMenuTree` (a structural, entity-tree
source — step 2 of `docs/menu-as-entity-tree-plan.md`), not a
hardcoded array; this layout still applies role filtering and
per-language translation on top, since those are separate, ordinary
concerns the structural fetch doesn't need to know about. If
`getMenuTree` fails, the menu silently falls back to empty rather than
blocking the app.

**Which top-bar section is "active"** is tracked by three different
effects, each fixing a specific regression found live:
- A default-to-"General Ledger" effect, since the real section key is
  a dynamic entity id that can't be hardcoded (the original app
  defaulted to General Ledger's own key being hardcoded) — only
  applied when nothing more specific (a direct URL match, or the
  person's own prior choice) has already set the active section.
- A URL-to-section matching effect: `activeSectionKey` must be
  recalculated from the current URL on every navigation, not only
  set by a direct top-bar click (previously, a bookmark, a refresh, or
  browser back/forward left the sidebar showing the wrong section).
  `/setup` itself (the Configuration landing page) has no direct menu
  link of its own, so it needs an explicit case rather than a prefix
  match — a plain "starts with /setup" prefix would wrongly claim
  `/setup/periods`/`/setup/yearend`, which belong to General Ledger.
- `setActiveSectionHighlight` only updates the highlight, never
  navigates — the reactive URL-watcher that calls it runs on every
  navigation including a direct click on a specific, non-first link
  (e.g. Vendors), and re-navigating there would wrongly bounce that
  link back to its own section's first link.

`onTopBarSectionClick` is the one place that DOES auto-navigate — to
the clicked section's first real link — since a top-bar click
previously left the main panel showing whatever page was already
open, never changing the URL at all.

**Keyboard navigation** (`moveFocusWithinContainer`,
`onTopBarKeydown`, `onSidebarKeydown`, `onMainKeydown`): a generic
helper moves focus to the next/previous matching sibling within a
container, given a CSS selector, stopping at the first/last item
rather than wrapping (simpler and more predictable for a hierarchical
menu). Moving focus with arrow keys must also immediately activate the
newly-focused item — the same "click" behavior each item already has
— since focus alone doesn't drive either the top-bar's active
underline or the sidebar's active link highlight. After `goto()`
resolves (from either an arrow-key move or a direct mouse click),
SvelteKit automatically refocuses `<body>` for accessibility reasons,
undoing the focus just set — both code paths re-focus the
just-navigated element again once that navigation genuinely completes,
not before. **`onMainKeydown`** (Esc) returns focus to the sidebar
from a main-content panel, but warns first via `confirm()` if that
panel has an unsaved edit pending (`hasUnsavedEdit.current`, opted
into per page — see the State chapter above).

**Login/session redirect gates** (`$effect` pair near the top): two
gates in order — logged in at all, then which business/ledger/
language — since login must come first. The `browser` guard matters:
SvelteKit renders this layout server-side first, and calling `goto()`
during that server render throws; the redirect must wait until this
is genuinely running client-side.

**RTL support** (`textDirection`, `loadTextDirection`) mirrors the
sidebar and reverses the main menu's order for a right-to-left
language, using the same generic `getLanguageDirection`/
`setLanguageDirection` mechanism already proven on Login and Choose
Business — never a hardcoded language-name check. The CSS mirroring
for RTL (`.shell[dir="rtl"] .sidebar`, near the bottom of the file)
only overrides margin/padding/border, which don't auto-flip with
`dir`: `flex-direction: row` already respects `dir="rtl"` natively,
so adding `row-reverse` on top double-reverses it (confirmed live —
the submenu moved back to the wrong side when that was tried).

**The live clock** (`now`, `liveClockText`) shows the browser's own
current locale/timezone (via `Intl`, the same mechanism the backend's
location-timezone work relies on — see the Stock API chapter), not a
static load-time snapshot, so a person can confirm what date/time/
locale the app currently believes it is. Updates every 30 seconds, not
every second — confirming the approximate time doesn't need
second-level ticking, and a slower update means far fewer re-renders
of this header on every page. Hidden entirely under automated test
conditions (`navigator.webdriver`, the standard signal every
WebDriver-based tool sets), since a constantly-changing timestamp in
the page text is incompatible with a stable, deterministic test
snapshot — this was briefly disabled further during a shelf-capacity/
general-journal e2e hang investigation, now resolved (see
`docs/lessons-learned.md`); the clock itself was never the cause.

## `frontend/src/lib/format.ts` — number and date display

**`todayIsoDate`** returns today's date in `YYYY-MM-DD`, the shared
default several report pages use as a sensible starting point rather
than an empty date — an empty date silently means "show all of
history including transactions after any close," not a meaningful
snapshot.

**`UNIT_SCALE`/`scaleFor`/`decimalPlacesFor`** — how many
smallest-units make up "one" of a given unit code, a general concept
(not currency-specific, even though currency is the immediate need).
Verified against ISO 4217's real minor-unit data, not assumed: most
currencies use 2 decimal places, but JPY, KRW, ISK, VND and others
have no minor unit at all (whole-number amounts only), while BHD,
KWD, OMR, JOD and others use three decimal places. Anything not listed
defaults to 100 (2 decimal places), unchanged from this app's
pre-existing behavior. `decimalPlacesFor` is exported separately from
`formatAmount` for anything that needs the precision directly, such as
constraining an amount input's own step for a specific currency.

**`formatAmount`** applies the user's own explicit `number_format`
pattern directly — never `Intl` locale inference, which is exactly
what produced a wrong result before (`Intl.NumberFormat('en-AU')`
actually produces commas, not the space this business's convention
uses). It takes `numberFormat` as a required parameter rather than
reaching into the auth store itself, keeping it a pure, testable
function; callers pass `auth.current?.user.number_format ?? '1
000.00'` themselves. `smallestUnits` is always the input, since this
app's amounts are always stored as an integer count of the smallest
real subdivision (not every currency has cents — JPY has none at all,
BHD a smaller one still); `unitCode` is optional, defaulting to the
standard 2-decimal case. A negative amount is shown in parentheses
(`"(1,234.56)"`), never a leading minus sign — standard accounting
convention, and purely a display choice: a negative total itself (a
net loss, a deficit) is still a legitimate figure, this only changes
how it reads.

**`formatDate`** applies the user's own explicit `date_format` pattern
directly to an ISO date string (`YYYY-MM-DD`, this app's storage
format) — again never `Intl.DateTimeFormat` locale inference, for the
same reasoning as `formatAmount`, and again takes `dateFormat` as a
required parameter for the same testability reason.

## `frontend/src/lib/state.svelte.ts` — consolidated shared application state

The one consolidated home for every shared piece of application
state, using Svelte 5 runes throughout. Replaces five separate files
(`auth.ts`, `dirty-state.ts`, `menu.ts`, `session.ts`,
`translations.ts`) as part of this app's "one library of common code"
consolidation, alongside the runes migration itself.

- **Auth** (`auth`, `hasRole`) — the currently logged-in user, if any.
  Deliberately stored in `sessionStorage`, not `localStorage`: a
  financial application shouldn't stay logged in indefinitely just
  because the token is sitting in storage — closing the browser should
  mean logging in again next time. `sessionStorage` still survives an
  ordinary page reload within the same tab, but clears when the
  tab/window closes, unlike `localStorage`, which persists across
  browser restarts entirely.
- **Dirty state** (`hasUnsavedEdit`) — pressing Esc while in a
  main-content panel should return focus to the left sidebar, but if
  that panel has a genuine unsaved edit pending, Esc should warn first
  rather than silently discard it. Any individual page opts in by
  setting this true while it has an unsaved edit, and false again once
  saved or discarded — the shared layout only ever reads it, never
  assumes a page's own internal state.
- **Menu** (`menuTree`, `screenTitle`) — the live, resolved menu tree,
  populated once by `+layout.svelte` (the same pattern as
  `$session`/`$auth`/`$translations`), so any page can resolve its own
  screen title through the exact same source its own menu label uses,
  without a separate, duplicate fetch. `screenTitle` is step 3 of
  `docs/menu-as-entity-tree-plan.md` §5 ("screen titles reading from
  the same source"): renaming a menu item in the editor then
  automatically also renames the report's own heading — one edit, not
  two separate places to keep in sync.
- **Session** (`session`, `SessionContext`) — the currently active
  business/ledger/language. `profitCenterId`/`profitCenterName` were
  added per `docs/profit-centers-design.md`'s Phase C: chosen the same
  way Business already is — automatically, with no visible choice,
  for a user restricted to one; a picker, like Business/Ledger, for
  staff with access to several. Both are `undefined` for every
  business with zero Profit Centers, the same case as before this
  feature existed. Trust model only: nothing here is enforced yet (the
  design doc makes the same finding about Business itself) — any user
  can still pick any Profit Center shown, same as Business today. The
  value read back from `localStorage` is cast to `BusinessName`/
  `LedgerName` once at this one boundary, the same reasoning as a
  database read or an API response.
- **Translations** (`translations`) — maps a vocabulary entity's
  canonical (English) name to its text in the currently selected
  language (e.g. `translations.current['Save']` might be `'Speichern'`).
  Falls back to the English name itself for anything not translated,
  the same as the backend's `localized_text` view does; populated by
  the layout whenever the session's chosen language changes.

## `frontend/src/lib/pagination.ts` — the shared paginator

**`createPaginator`** is the one implementation of "load a page, go to
first/previous/next/last page" every paginated list in this app
should use — created once per page component (each call gets its own
independent state), not shared globally. `fetchPage(limit, offset)` is
the only thing that varies between callers; everything else (page
tracking, hiding Newer/Older, hiding the whole pager, computing "page
n of nn" when a total count is available) is handled once, here.
`pageSize` defaults to the logged-in user's own `page_size` preference
when omitted, rather than a fixed constant every page independently
hardcodes.

```ts
const journal = createPaginator((limit, offset) =>
  listJournalEntries(business, ledger, limit, offset)
);
onMount(journal.load);
// in the template: {#each $journal.items as item}...
// pager: <Pager paginator={journal} />
```

`PaginatedState.showPager` is false when everything already fits on
one page. `totalCount`/`totalPages` are only known when the backend
reports a total count (not every list does yet) — `null` means
"unknown," not zero; when known, it enables "page n of nn" and jumping
straight to the last page. `FetchPageResult.totalCount` is optional
for the same reason: a list backed by a count endpoint provides it, a
list that doesn't yet simply omits it and falls back to the plain
Newer/Older behavior this already had.

## `frontend/src/lib/entityTree.ts` — filtering the entity tree down to real products

**`isDescendantOf`** walks an entity's `parent_id` chain to determine
whether it descends from a named ancestor (e.g. "Items"). This exists
because "is this a postable leaf?" is true for every leaf GL account
(Cash and Bank, Sales Revenue, everything) just as much as for an
actual product — postable-ness says nothing about which branch of the
tree something lives in. A dropdown meant to offer "which product"
must filter by ancestry, not by postable-leaf-ness alone.

**`isInternalItemRecord`** is the structural check for whether an
entity is — or lives beneath — one of a real product's own internal,
per-item records (quantity sub-accounts, source/cost records, and
anything nested under those), as opposed to being a real, user-named
catalog item or category. It checks a fixed set of known bare names
(`INTERNAL_ITEM_RECORD_NAMES`: `On Order`, `Units Sold`, `Count
Adjustment`, `Write-off`, `Item Source`) together with the generated,
structural `" — Source — "` naming pattern that `addOrUpdateItemSource`
(see the Entity Model chapter) uses for item-source records — and,
critically, it walks UP from the entity through every ancestor
(stopping at "Items", the real catalog root), not just the entity's
own immediate parent. This generality matters: once a product has any
stock movement it gains bare-named quantity sub-accounts as direct
children, and once an item source is registered it additionally gains
a generated `"<name> — Source — ..."` child which itself has its own
child literally named `'Item Source'` — two levels below the real
product, not one. A one-level check misses the second case entirely,
which is exactly the bug `filterToItems` hit before this walked the
full ancestor chain: the source record's own child ("Item Source")
would wrongly appear in an Item dropdown in the real product's place.

**`filterToItems`** is the actual dropdown filter: leaf entities that
are descendants of "Items". It deliberately does NOT require
`is_postable_account` — a real product never has that flag set (it
posts via direct quantity movement against the item's own entity,
never the `account` table), so requiring it would exclude every real
product. Ancestry and leaf-ness are what define "this is a sellable
product," not postable-account-ness. It also treats a product with
only internal quantity sub-accounts as its own direct leaf (via
`isInternalItemRecord` filtering those children out before the
leaf-ness check) — without this, a product with real stock movement
against it has real children, so a naive leaf check excludes the
product itself and returns only its own internal sub-accounts instead,
which is the bug that was found live in the Purchase Order page's own
Item dropdown.

## `frontend/src/lib/journalGrid.ts` — the General Journal entry grid

Pure logic for a classic General Journal entry grid — no staging
concept here, no network calls: a row is just `{account, debit,
credit, memo}`, the way a bookkeeper actually thinks about a journal
entry, not "a line I've staged."

**Rows are only ever added or removed by an explicit action**
(Insert/Delete, or the person's own click) — never automatically as a
side effect of typing. An earlier version auto-added a new blank row
the moment the last row became "filled" (had both an account and an
amount); this produced a real bug: filling row 0 auto-suggests row 1's
amount before row 1 has an account yet, so row 1 doesn't count toward
the totals (`isRowFilled` correctly requires both) — but the moment
you then pick row 1's account, it *becomes* "filled" by that same
definition, silently spawning an unwanted third row. Removing the
auto-expansion removes that whole class of surprise.

- An amount typed into a cell is always a magnitude — direction comes
  from which column (debit vs. credit) it was typed into, never from a
  minus sign. Typing `"-500"` into Debit must not silently behave like
  a credit of the same size; the user should never be able to type or
  see a negative number at all.
- **`isRowFilled`** — a row only counts toward the entry once it has
  an account AND an amount; a still-being-filled-in row sits
  harmlessly in the grid without being submitted or affecting the
  balance.
- **`rowsWithAmount`** — deliberately looser than `isRowFilled`: the
  footer totals and the auto-balance suggestion should reflect an
  amount the instant it's entered, not wait for an account to also be
  picked (a real, found gap: an auto-suggested amount could visibly
  sit in a row while the running totals silently excluded it, since it
  had no account yet). Only `isBalanced` still needs the stricter,
  complete-row requirement, since an amount with no account genuinely
  can't be saved.
- **`hasIncompleteRow`** — a row with a real amount but no account yet
  is genuinely incomplete, not ready to save even if every amount
  otherwise balances to zero.
- **`ensureAtLeastOneRow`** — used only after removing a row leaves the
  grid empty, never to auto-add a row as a side effect of typing into
  an existing one.
- **`addRow`** — the explicit action behind the Insert key (or a
  person's own "add line" gesture), never automatic. Immediately
  re-suggests the new trailing row's balancing amount, since the entry
  may already be visibly unbalanced the moment this row appears, and
  that's exactly when the suggestion is most needed. Passing `-1` as
  the "changed index" guarantees the recompute path always runs, since
  no real row index is ever negative.
- **`removeRowAt`** — the explicit action behind the Delete key. Never
  lets the grid go completely empty; if removing the last remaining
  row, replaces it with a fresh blank one instead. Also re-suggests
  the (possibly new) trailing row's balance, since deleting a row
  changes which rows count as "the others" for balancing purposes.
- **`computeSuggestedFill`** — what the trailing row's amount *would*
  need to be to balance the entry, given every other filled row: a
  suggestion only, not something applied without the person's
  awareness (`autoBalanceTrailingRow` is what actually applies it).
  Returns `null` if there's no real imbalance worth suggesting
  (nothing else filled in yet, or already balanced).
- **`autoBalanceTrailingRow`** — auto-fills the last row's debit or
  credit (whichever side balances the entry) whenever some OTHER row
  changes, never when the edit was to the last row itself, which is
  what `changedIndex` tells this function. Checking "is the trailing
  row currently empty" is NOT enough (an earlier version tried exactly
  that and failed a real test): once the trailing row has been
  auto-filled once, it's no longer empty, so a later edit to some other
  row would be wrongly treated as "the person is typing into the
  trailing row" and left stale. Deliberately does NOT add or remove
  any rows — that's `addRow`/`removeRowAt`'s job, never a side effect
  of this.
- **`autoExpandIfTrailingRowFilled`** — appends a new blank row only
  when BOTH the current last row has genuinely become complete AND the
  entry is still unbalanced afterward; if the rows already balance to
  zero the moment that row fills in, nothing more is needed. A new row
  reappears later on its own via `autoBalanceTrailingRow` if editing an
  amount throws the entry out of balance again. Deliberately narrow —
  checking only the trailing row (never some other row that happens to
  become filled) means this can only ever add one row at a time, and
  only right when it's actually needed; this is the exact historical
  bug class this project hit before.
