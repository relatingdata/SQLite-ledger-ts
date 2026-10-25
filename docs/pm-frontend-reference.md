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
  for the same item/provider pair, never a currency conversion.
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
duplicates. The create-provider path specifically (per
`docs/contact-types-and-translations.md`) routes through
`createProvider` rather than a generic structural parent, so a new
provider is genuinely tagged with its own Contact Type, not just
structurally parented. `setContact` always sends the complete current
form state — it's a full replace, not a partial merge (see
`schema.sql`'s note on `contact_entry`) — so a partial send would
silently wipe whatever field isn't included.

## `frontend/src/routes/login/+page.svelte` — the login screen

The brand name itself is never line-broken mid-phrase: a non-breaking
space joins each word, regardless of which translated language wraps
around it, without forcing the whole sentence onto one line (which
would risk overflow on a narrow screen).

**Display language on login** only changes what language the login
form's own labels show in, entirely separate from choosing a business/
ledger, which needs an actual session and comes after logging in.
Priority: a person's previously-chosen preference (if they've been
here before and picked something) beats the system default; the
system default beats a hardcoded English fallback for anyone new. The
system default has to live somewhere reachable before login exists at
all, since this screen itself needs it — see `getDefaultLanguage`/
`setDefaultLanguage` in `db.ts` (Entity Model chapter) for where. The
language list is a nicety, not required to log in — it falls back to
English silently if it fails to load.

RTL mirroring here needs an explicit override because absolute
left/right positioning does not automatically flip with `dir="rtl"`
the way `text-align` or `flex-direction` do.

## Smaller files: short design notes

- **`setup/users/+page.svelte`**: per `docs/user-business-role-matrix-design.md`,
  the per-business User × Role Cartesian Product is a second, additive
  fact alongside the global roles table, which it never changes.
- **`setup/hierarchy/+page.svelte`**: new-dimension entry is a growable
  list of (dimension name, grouping name) pairs — the same shape
  `defineProductShape` expects — built up one row at a time rather
  than a single, fragile text field a person would have to format
  exactly right.
- **`reports/storage-space/+page.svelte`**: storage-space currencies are
  physical unit counts (cartons, bottles), never a dollar amount, so
  they're shown as plain whole numbers, never run through
  `formatAmount`'s currency-cents formatting.
- **`reports/new-stock-on-hand/+page.svelte`**: further business-chosen
  hierarchies are appended live once read from the business's
  Hierarchy configuration, never hardcoded; the axis dropdowns still
  work with just Product/Category/Location/Consolidated if that load
  fails.
- **`lib/components/ContactPersonList.svelte`**: superseded by
  `ContactList.svelte` (this list may hold organizations or subunits
  too, like "Help Desk", not only individual people) — kept as a thin
  re-export, never deleted, in case anything still imports this
  original name.
- **`setup/bank-accounts/+page.svelte`**: every group under every
  hierarchy a business has actually configured (e.g. "Division," or
  any other chosen name) is included — never a single privileged
  hierarchy name hardcoded here.
- **`reports/sales/+page.svelte`**: the same `{@html}`-reactivity fix
  as Balance Sheet (see that chapter above) — splitting on `{NAME}`
  rather than an inline `.replace()` inside `{@html}`.
- **`lib/treeAdapter.ts`**: converts the flat, `parent_id`-based entity
  list into the dot-separated path format `@keenmate/svelte-treeview`
  expects (`"1"`, `"1.1"`, `"1.1.2"`, ...), assigning each node's
  position among its siblings by name order.
- **`lib/components/WeeklyHoursGrid.svelte`**: the local working copy
  is one row per day of the week, always all 7, with an "on" flag
  driving whether that day's times are actually included in the
  emitted `lines`.
- **`lib/auth.ts`, `lib/dirty-state.ts`, `lib/translations.ts`,
  `lib/menu.ts`, `lib/session.ts`**: superseded by the consolidated
  `state.svelte.ts` (see that chapter above) as part of the "one
  library of common code" consolidation. Nothing in the app imports
  these five files any more; they're left in place rather than
  deleted, per this project's "recoverable, not silently discarded"
  convention (the same one `// UNUSED (checkpoint N)` markers follow
  elsewhere — see `docs/unused-functions.md`).

## `frontend/src/lib/components/AddressList.svelte` — the combined address box

Address line 1/2 are combined into a single multi-line "Building &
Street Address" box in the UI, not two separate fields. Still stored
as `address_line1`/`address_line2` on the backend (no schema change):
the first line a person types becomes `address_line1`, everything
after becomes `address_line2`, joined back into one box the same way
when re-displayed.

## `frontend/src/app.d.ts` — SvelteKit app types

`version` is the frontend's own build-time version, injected by
`vite.config.ts` from the same single `VERSION` file the backend reads
at startup (see `checkVersion` in the api.ts chapter above).

## `frontend/src/lib/matrix-api.ts` — self-contained fetch wrapper

A small, deliberately self-contained fetch wrapper: duplicates
(rather than imports/exports) the same simple pattern `$lib/api.ts`
already uses internally, since that helper isn't itself exported and
this file must not modify `api.ts` at all.

## `frontend/src/lib/components/AxisPLNode.svelte` — the P&L axis tree node

The disclosure's initial open/collapsed state deliberately captures
`openByDefault`'s value only once, per its own name — this sets the
starting state of a further, user-togglable disclosure, never meant
to force-collapse or force-reopen an already-interacted-with node if
a parent later re-renders with a different default (hence the
`svelte-ignore state_referenced_locally`).

## `frontend/src/lib/components/HierarchyGroupTreeNode.svelte` — group display stripping

A per-location group can never literally share its own location's
name (entity names are globally unique — the "Head Office" location
already exists), so it's genuinely named `"Head Office
<hierarchyName>"` underneath (e.g. "Head Office Division"). That's a
necessary implementation detail, not something a person picking a
group from a dropdown needs to see — stripped here for display only,
using whichever business-chosen hierarchy name was actually passed
in, never a hardcoded "Division"; `name` itself (used for the actual
selection) is untouched.

## `frontend/src/routes/setup/chart-of-accounts/+page.svelte` — the CoA tree

**Structural anchors**: the five top-level report categories are
never offered for rename or delete here, regardless of whether the
underlying `revokeEntity` safeguards (no children, no postings) would
technically allow it — this is a deliberate guard rail for the
accounting structure itself, not just data integrity, since the
Balance Sheet and P&L's own shape rests on these existing exactly
where they are.

## `frontend/src/routes/reports/statement/+page.svelte` — the Customer/Provider Statement report

A race is possible here: `loadCustomers()` fetches the full entity
tree, which can take a moment on a populated business — long enough
that a person could already change the customer or date before it
resolves. Without a guard, a slower, earlier request's result could
land last and silently overwrite the person's later choice. Fixed the
standard way: each call captures its own request id, and only applies
its result if it's still the most recent request by the time it
completes.

## `frontend/src/routes/reports/trial-balance/+page.svelte` — the Trial Balance report

The same `{@html}`-reactivity fix as Balance Sheet applies here (see
that chapter above). Per the User Manual's specification of this
screen, every currency present gets its own clearly separate group of
rows, never one flat list mixing a dollar account next to a
bottle-count account as if they were the same kind of number: a
storage-unit or quantity currency is shown as a plain whole-number
count (`fmt` would wrongly treat it as cents); only a null (home) or
other monetary currency is run through `fmt`.

## `frontend/src/routes/arap/ap-purchase/+page.svelte` — the Invoiced Purchase screen

Auto-add matches Cash Sale/Purchase and AR Sale's established
convention (see the CashTransaction chapter above). Items are scoped
per business. Any postable account can be the "what this purchase was
for" side — an expense (Office, Rent) or an asset (Inventory).

**Stock receipt on an on-account Purchase.** A line whose item name
matches a real catalog item is received into stock automatically,
alongside the invoice — the same "physical stock IN and the AP
invoice, posted together" mechanism as PO fulfillment and Cash
Purchase, just reached from the plain on-account screen instead. A
line that isn't a real catalog item (an expense like Office Rent,
posted straight against its own account) is left alone — `itemName`
here can genuinely be either, and only the real-item lines are checked
against `items`/`itemsByName` to decide. `purchaseLocation` — long
captured in state but never actually sent anywhere — is now required
whenever at least one line needs it, and `receiveStock` runs before
`postInvoiceById`, matching Cash Sale's "the physical step most likely
to fail runs first" ordering (see the CashTransaction chapter), even
though receiving stock essentially never fails for want of a location.

## `frontend/src/routes/reports/new-pl/+page.svelte` — the P&L pivot table

Further business-chosen hierarchies (e.g. "Division") are never
hardcoded — read live from the business's own Hierarchy
configuration. Location and any further hierarchy are the same one
hierarchy (Location Categorization) at two grains; the same is true of
Category and Product (Product Categorization) — crossing a hierarchy
against its own other level is redundant (see the fuller comment in
the New New P&L chapter above). The axis dropdowns still work with
just Product/Category/Location if that configuration lookup fails;
further hierarchies are an addition, not a requirement. Row/column
keys and the (row, col) → cell lookup are built once in the standard
pivot-table shape.

## `frontend/src/routes/reports/stock-movement/+page.svelte` — the Stock Movement report

Grouping names offered are never hardcoded to one privileged
hierarchy — "group" stands for whichever one a business has actually
configured (e.g. "Division"), read live, alongside the three
structural groupings every stock movement row always has: location,
provider, category. The report still works with no group tagging at
all if that lookup fails. Every group starts collapsed, the same
pattern already proven on the P&L and Inventory Listing reports —
subtotals first, detail on demand. Transfers have no group/provider of
their own, so grouping by location falls back to the destination,
since that's the receiving side a person actually cares about
grouping by.

## `frontend/src/lib/components/HierarchyGroupTreePicker.svelte` — the nested group picker

A group can genuinely be nested (a per-location group under a
per-city one) — built into an actual tree here, not left as the flat
alphabetical list a plain `<select>` forced everything into, since the
whole point of this picker is to make that structure visible:
Consolidated (the company) → group → Location, any level directly
choosable, not just the leaves. `hierarchyName` is never hardcoded —
a caller passes its own chosen hierarchy name (e.g. "Division").
Groups whose own parent isn't itself a group (e.g. a city group
parented directly under an application root) are the top level here
— found by checking which parent names never appear as a group's own
name.

## `frontend/src/routes/stock/restock/+page.svelte` — the restock suggestions screen

**Suggestions** list every product genuinely below its own reorder
level at the selected outlet, topped up to its own max level — a
starting point matching what a store manager would actually notice
("this product's shelf is looking thin"), not a blank form to fill in
from memory. A per-outlet total is computed directly in the function,
not read from the reactive `suggestions` variable, since that
function runs on the same tick as the outlet selection change, before
Svelte has recomputed `suggestions` for the newly-selected outlet —
reading it there would use the stale, previous value.

## `frontend/src/routes/reports/compare/+page.svelte` — the period comparison report

A net income total can genuinely be negative (a net loss) — shown
parenthesized and in red, the same convention as everywhere else,
never as a bare negative number. Unfavorable variances are shown
parenthesized the same way, matching the contra-balance styling on
Balance Sheet/P&L, but this takes "is this unfavorable" explicitly
rather than inferring it from raw sign: favorable/unfavorable flips
between Income (more is good) and Expense (less is good), so the same
positive number needs opposite treatment depending on which section
it's in. The same `{@html}`-reactivity fix as Balance Sheet (see that
chapter above) applies here too.

## `frontend/src/routes/arap/ar-sale/+page.svelte` — the Invoiced Sale screen

Auto-add matches Cash Sale/Purchase's convention: a fresh empty line
appears once every existing line has an item name filled in, so
there's never an "Add line" button (see the CashTransaction chapter
above). The credit-limit check is a non-blocking warning, never
silently refusing the sale, since account management practice
sometimes genuinely extends credit past a nominal limit for a trusted
customer — this only makes sure that's a deliberate, informed choice,
not an accident. Items are scoped per business, never fetched before
the business is known. Customers live under Accounts Receivable in
the entity tree.

**Stock dispatch on an on-account Sale.** Mirrors AP Purchase's own
new "Stock receipt" paragraph above: a line matching a real catalog
item is dispatched from stock automatically, alongside the invoice —
every real sale in this application moves real stock, there's no
"expense sale" concept the way AP Purchase has non-inventory expense
lines. `saleLocation` — long captured in state but never actually
sent anywhere — is now required whenever at least one real-item line
is present, and `dispatchStock` runs before `postInvoiceById`, for the
same reason Cash Sale's does: a failed dispatch (not enough stock on
hand) must never leave a posted invoice behind for stock that was
never actually sent out.

## `frontend/src/routes/stock/po/+page.svelte` — the Purchase Order screen

**Known sources** for the selected item ("purchase orders need to
match suppliers of products being ordered") are fetched fresh
whenever the item changes; they drive which providers are offered and
auto-fill the preferred one's known price. A PO can still be placed
even if the known-sources list fails to load — it's a direct guide,
not a hard requirement.

**Provider list** is the item's own preferred source's provider first,
then every other known alternate; `showAllProviders` is the escape
hatch for a genuine new, one-off supplier this item has never been
bought from before — never silently blocked, just not the default.
Changing the provider directly (picking a known alternate instead of
the auto-selected preferred one) follows that source's own known
price too, rather than leaving a stale figure from whichever source
was previously selected.

## `frontend/src/lib/money.ts` — currency and quantity parsing

Both parsers (`toMinorUnits`, the quantity equivalent) always return a
non-negative magnitude: a person should never be able to type or see
a negative number anywhere in this application; direction (debit vs.
credit, receipt vs. payment, a negative quantity typed into an order/
dispatch/receipt screen) always comes from which field or screen it's
entered on, never from a typed minus sign. Invalid or empty input is
treated as zero, the same as `journalGrid`'s `toMinorUnits`.

**Known gap, not fixed here**: `toMinorUnits` always assumes 100 minor
units per major unit (a "cents"-style, 2-decimal currency) — correct
for USD/EUR/GBP and most others, but wrong for a genuinely zero-decimal
currency (JPY, KRW) or three-decimal currency (BHD, KWD).
`decimalPlacesFor(unitCode)` in `format.ts` (see the Format chapter)
already has the correct per-currency scale; this function doesn't yet
take a unit code and apply it.

## `frontend/src/routes/stock/transfer/+page.svelte` — the Stock Transfer screen

On-hand quantity is re-checked and the destination reset whenever the
item or source location changes — the same dynamic dependency the
original hand-written page already had. Per
`docs/canned-journal-to-frontend-design.md` Phase 1: the physical
quantity movement (`transferStock`) happens first, deliberately,
since it's the step most likely to fail (not enough stock on hand, or
the two locations aren't actually in the same city), and a failed
transfer must never leave a posted dollar journal entry behind for
stock that never actually moved. The canned account selection for the
dollar VALUE entry is computed client-side by `transferLines` (see
the canned-journal chapter); the backend is only asked to
resolve/create the Inventory accounts and move the stock.

## `frontend/src/routes/stock/listing/+page.svelte` — the Stock Listing report

The hierarchy locations are grouped by (e.g. "Division", or any other
business-chosen name) is never hardcoded — it's read live from the
business's own Hierarchy configuration, first grouping found; with
none configured, every location simply has no group, and the report
still works with no group tagging at all if that lookup fails. Groups
are built directly from the same group tag
`getInventoryListingByLocation` already computed, not re-derived
here; locations with no group fall under an explicit "(No group)"
group rather than being silently dropped. Every group and every
location starts collapsed — totals first, detail on demand, the same
pattern already proven on the P&L report.

## `frontend/src/routes/session/+page.svelte` — the Business/Ledger/Profit Center picker

**Default ledger** per `docs/active-ledger-design.md`: the business's
"active" ledger (set at business creation, flipped by a rollover) is
the strongest, most current signal — a soft switch onto wherever
ordinary trading actually moved to, with no forced logout. Falls back
to whatever this screen already did for a business created before
this concept existed (`null`).

**Profit Centers**, per `docs/profit-centers-design.md` Phase C: a
business with zero Profit Centers (every business, until one is
explicitly created) gets an empty list and no picker shown at all —
purely additive, exactly like Phase A's own structural accounts. A
Profit Center is only ever included in the saved session when the
business actually has one chosen; a business with none must store
exactly what it always has (`undefined`), never a stray empty value.

**Reactive display translation** uses the same pattern the login page
uses: `translations` is normally populated from
`session.current.languageName` everywhere else in the app, but there's
no session yet while picking one, so this page needs its own direct
wiring, same as login does before authentication exists at all.

## `frontend/src/lib/components/Form.svelte` — the generic form component

The one generic form component this whole application composes, per
`docs/one-file-per-page-consolidation-plan.md`. Restrictive by
construction, matching the same closed field-type set already
designed for the business-type questions: text, number, select,
password, date. No conditional logic, no branching, no computed
fields — if a page needs to decide something from an answer, that's
code around this component, not a new feature grown into it.

**Enter-to-submit** from any field is a generic feature every form
gets for free, rather than a per-page workaround. (Component exports
cannot be bound to in Svelte 5 runes mode, so this can't be exposed
via `bind:this` for an external caller to trigger instead — handling
it here, once, is the correct fix, not a workaround.)

## `frontend/src/routes/reports/old-pl/+page.svelte` — the original consolidated P&L

"Division" here is only ever a business-chosen hierarchy name — the
one this particular demo business happens to use — not a hardcoded,
privileged concept; a business could configure any other hierarchy
name instead and this page would work identically against it.
"Consolidated per Division" belongs inside this same one P&L report,
not as a separate report page, with the same drill-down capability —
"Per Division" and picking one specific group via the tree picker are
mutually exclusive views of the same underlying report.

**Default date range**: once a Year End Close has run (zeroing every
Income/Expense account, exactly as intended), a blank date range shows
"right now" — correctly zero, but reads as broken to a person who
never set a date on purpose. Defaults to the ledger's own
earliest-to-latest activity instead, so the first thing shown is
genuinely real data, not a technically-correct but misleading zero;
defaulting the range is a convenience, not a requirement, so it falls
through to "all time" if that lookup fails.

## `frontend/src/routes/pos/+page.svelte` — the POS terminal screen

Per `docs/multicurrency-design.md` Slice 4, each POS terminal is a
single cash drawer transacting in exactly one currency: an ordinary
retail outlet has none of these at all, while a border-town one may
show two or more terminals, one per distinct currency it actually
serves customers in. Every terminal a location actually has, each
with its own resolved currency (or none, the ordinary home-currency
case), is reloaded whenever the selected location changes; an
ordinary location returns an empty list, and this is non-critical —
the register still works without it, in the home-currency case.

A combination-tagged item's price is resolved server-side
(`getItemPriceForCurrency`, checked against its exact combination
first) and omitted here entirely rather than defaulting to the item's
separate base retail price (or, worse, a bare 0). The barcode scanner
flow tries an exact UPC match first (a scanner types the UPC then hits
Enter); if nothing matches, it falls back to the first name search
hit.

## `frontend/src/routes/setup/yearend/+page.svelte` — Close Books and Rollover

**The close-books breakdown** walks Location, then whatever further
hierarchy a business has actually configured (e.g. "Division") —
never a single privileged name hardcoded here; read live from the
business's own Hierarchy configuration. If that fails, the close
still works with just a Location breakdown.

**Close Books posting**: `previewCloseBooks` has already done all the
arithmetic, so `completeClose` posts the already-computed
`preview.lines` directly from the frontend via the same generic
`stageLine`/`postJournalEntry` calls the General Journal "Save"
button uses, rather than the old all-in-one `closeBooks()` backend
call — there is nothing left to re-derive, only to post.

**Rollover posting** follows the same split: `resolveRolloverLines`
does the genuinely stateful half (creating each carried-forward
account's node under the new ledger) server-side and returns the
already-computed opening-balance lines; the frontend posts them
itself via the same generic staging calls, rather than re-deriving
anything. A ledger of the target name may already exist from an
earlier, half-finished rollover attempt — rolling into it is still a
valid case; any other genuine problem creating it surfaces anyway once
`resolveRolloverLines` can't find the ledger it needs.

**Real sub-annual close support**: a "Reporting period" `<select>`,
shown only when `getReportingPeriods` returns anything (i.e. the
current business has a stored financial-year start/frequency —
`[]` otherwise, and the section simply doesn't render), lets the
person pick a real period (e.g. "Q2 2026-27") instead of typing an
`asOfDate` and a new ledger name by hand. `applySelectedPeriod` fills
in `asOfDate` from the period's real `endDate` and, if the Rollover
section's target is still "new ledger" with no name typed yet,
suggests `"Actual <period label>"` — still freely editable, never a
hard constraint. See `docs/pm-domain-reference.md` ("Reporting
periods") for why no backend changes to `closeBooks`/
`rolloverToNewPeriod` themselves were needed.

## `frontend/src/routes/reports/pl-pivot/+page.svelte` — the drag-and-drop P&L pivot builder

Per `docs/pl-pivot-builder-dnd-plan.md`, this enforces the same
`opposingHierarchyAxes` constraint `new-new-pl` enforces via its two
dropdowns (see the two-axis P&L chapter above): a business's further
chosen hierarchy and Location are the same hierarchy at two different
grains, and so are Category/Product, so crossing either against its
own other level is redundant, never a second independent axis. No
further hierarchy name is hardcoded; `LOCATION_HIERARCHY` is filled in
once `axisValues` loads, with whatever hierarchies the business
actually configured. Further business-chosen hierarchies and the
specific-value narrowing are both a convenience, not a requirement —
the zones still work with just Location/Category/Product if that load
fails.

**Drag-and-drop zones**: a per-zone narrowing value ("this whole axis"
vs. "just this one specific value within it") is attached to the zone
itself once it holds a chip, per the plan's stated design, rather
than a separate disconnected control. A drop zone holds exactly one
axis at a time — a second chip landing there bumps the zone's prior
occupant back to the tray, rather than allowing two. A redundant
same-hierarchy crossing makes the chip visibly, immediately return to
the tray instead of silently producing a self-crossed, meaningless
report.

## `frontend/src/routes/setup/vocabulary/+page.svelte` — per-business word-choice overrides

The current business's structural entity id is resolved once from the
already-available entity tree (rather than a new endpoint) for use as
the `scope_id` of a business-level preference. The per-concept
selection state defaults to whichever alternate word the business
already currently sees (resolved via `translations.current`, the
same live source every other page reads), so the form opens already
reflecting the current choice, not a blank one — it's resolved from
`translations.current` against the known `defaultAlternate` (the one
stable key any preference actually overwrites), then matched back to
whichever alternate currently produces that same resolved text.

Choosing the original default word back is a direct "reset to
default" — it removes the preference entirely, rather than leaving a
redundant override row saying the same thing the default already
would. After saving, the current translations are reloaded, the same
way the whole app already does on login/business change, as live
confirmation the change actually took.

## `frontend/src/lib/components/PaymentReceipt.svelte` — the shared AP Payment/AR Receipt screen

This is the one real screen behind both "AP Payment" and "AR
Receipt": the two original separate files differed almost entirely by
parameter-swapping (provider↔customer, Accounts Payable↔Accounts
Receivable, "paid"↔"received") — one screen, parameterized by
`direction`, static for the component's lifetime, the same pattern as
`CashTransaction.svelte` (hence the same `svelte-ignore
state_referenced_locally`).

**Outstanding invoices** for the currently-selected party, each with
its own remaining balance, are fetched fresh whenever the party
changes. A payment/receipt can still be recorded even if that
outstanding-invoice list fails to load — allocation against invoices
is an optional additional step, not a hard requirement.

**Allocation** against specific outstanding invoices is optional and
best-effort per invoice: one failed allocation doesn't undo the
payment/receipt itself, which has already genuinely posted. Each
allocation uses a reference distinct from the payment/receipt's own —
reusing the payment/receipt's own reference would collide with its
already-posted journal entry.

## `frontend/src/routes/setup/translations/+page.svelte` — the translator screen

**Pending edits** are a local, plain object keyed by language, one
entry per language, kept separate from `words` so an in-progress edit
doesn't need to be re-derived on every keystroke; only concepts the
translator has actually touched this session get an entry, everything
else reads its current target text (or a fresh copy of the reference
text, as an editable starting point rather than a blank field)
directly. After a save, the just-saved value is reflected locally
immediately, without a full separate reload.

**RTL support** is a per-language text-direction lookup, loaded once
alongside the language list and reused everywhere a translation input
or reference column is shown — never a hardcoded special case for any
one language, Hebrew/Arabic included.

**Reference language**: a translator working into a target language
may be more fluent in some third, already-translated language than in
English — "reference" is whichever language they choose to read while
they work, falling back to the native English wording (now a genuine
translation row of its own under the "English" Language, not merely
implied by a concept's own name) whenever the chosen reference
language doesn't have this particular word yet. English being a real
translation target removes the need for any English-specific special
case elsewhere in this screen.

## `frontend/src/routes/post/+page.svelte` — the General Journal posting screen

**CoA prototype filtering**: the account dropdown used to show every
account in the system, mixing every CoA prototype together
(German/French/Italian accounts alongside English ones) regardless of
which business was selected — fixed by filtering to the current
business's own prototype specifically, using the relation tag each
account and each business carries (see
`backend/scripts/tag-coa-prototypes.ts`). Accounts with no prototype
relation at all are always shown: product-specific Sales/COGS accounts
(named `"Sales - ..."`/`"COGS - ..."`, already tagged COGS for a
different purpose) and customer/provider contact accounts are universal,
not tied to any one CoA prototype.

**Debit/credit mutual exclusion**: a single journal line is either a
debit or a credit, never both — a real bug let entering a value in
both fields on one line silently compute debit-minus-credit as a net
amount rather than rejecting the input, which could post a
wrong-sign figure with no warning. Typing into one field now clears
the other, matching standard accounting software, rather than relying
on a person to notice and self-correct.

**Insert/Delete on the grid**: Insert always adds a new row at the
end — it has no conflicting native meaning in a modern browser, so
it's safe to act on regardless of which field has focus. Delete is
trickier: a text input already uses Delete to remove the character
ahead of the cursor, so stealing that would break normal editing —
Delete only removes the row when there's nothing for it to do
natively: the account dropdown (not a text field at all), or a text
field that's currently empty.

## `frontend/src/routes/contacts/+page.svelte` — the Customers/Providers screen

**Contact fields** that still live directly on the contact record are
distinct from address/phone, which are now handled entirely by the
shared `AddressList`/`PhoneList` components — not a second copy of
the old `address_line1`/`phone` fields here. `setContact` is still a
full replace, not a partial merge, but since address/phone are no
longer part of what this screen manages at all (those components save
independently, immediately, the moment each is edited), there's
nothing to lose by omitting them here.

**Category scoping**: each category lives under a different branch of
the entity tree. The same real person can appear in more than one
list at once (an employee who's also a customer) — that's two
separate entities today, one per role, not one entity trying to
occupy two places in a tree that only allows a single parent. This
screen shows whichever category an entity actually belongs to; it
doesn't try to unify "these are the same real person" across
categories, a genuinely separate design question.

**Default category** is set by the menu link actually clicked
(Customers under Accounts Receivable, Providers under Accounts Payable),
not guessed: the same shared underlying page and mechanism stays
exactly as it was — customers and providers ARE genuinely the same kind
of record — but which one is shown by default is now clear from the
person's own immediate perspective, rather than left for them to pick
out of four lists every time.

## `frontend/src/routes/reports/profit-and-loss/+page.svelte` and `reports/new-new-pl/+page.svelte` — the two-axis P&L breakdown

**The axis dropdown** is a single, unified dropdown per vector:
"Consolidated" at the top, then each axis type as its own selectable
group-by heading, with every specific value listed directly beneath
in the same one dropdown — rather than two separate dropdowns (axis
type, then a second "narrow to one value" picker). Each option's
value is a combined string: the axis type alone ("Location") means
"group by every Location"; `"Location::Riverside Cellars"` means
"narrow to this one specific value," while still genuinely grouped by
Location underneath (so drill-down still shows correctly) — just
showing only the one chosen branch. If loading the specific-value
lists fails, the dropdowns still work with just the four group-by
headings; the per-value lists are a convenience, not a requirement.

**Hierarchy redundancy guard**: a business's further chosen
hierarchies (e.g. "Division") are never hardcoded — they're read live
from `axisValues`, whatever names the business actually configured.
Location and any such further hierarchy are the same hierarchy
(Location Categorization) at two levels of grain — a division is a
coarser grouping of locations, a location is that hierarchy's finest
leaf — and the same is true of Category and Product (Product
Categorization). Crossing a hierarchy against its own other level
("Division v Location", "Category v Product") is redundant, not a
second independent dimension — it's the same grouping crossed against
itself. A meaningful two-axis breakdown always crosses one whole
hierarchy against the other: Location-side (where a sale happened)
against Product-side (what was sold), in any combination including
drill-down within each. If changing one grouping's hierarchy would
leave the other showing a stale, no-longer-available selection (e.g.
Outer moves from Location to Category while Inner is still Product —
now the same hierarchy crossed against itself), that one resets to
Consolidated rather than silently keeping an invalid value selected.
This guard is a direct function call, not a reactive statement —
Svelte correctly rejects the reactive form here as a genuine cyclical
dependency (`outerAxis` depends on `outerSelection`, which the guard
itself would also assign).

## `frontend/src/routes/reports/balance-sheet/+page.svelte` — the Balance Sheet report

The `{@html}`-vs-template bug: an early version computed the
session-dependent heading text inline inside an `{@html}` block,
which never re-evaluated once `session.current` populated after the
page's first render — it only ever showed the "…" fallback, even long
after `session.current` genuinely was ready, even though the same
read works fine elsewhere on the page (`load()`). The underlying
reactive variable recomputed correctly the whole time; Svelte's
hydration just doesn't reliably re-diff `{@html}` content against a
later client value once the server-rendered pass (which always sees
`session.current` as null, since it reads from browser storage) has
already run. Fixed by splitting on the `{NAME}` placeholder and
rendering each piece as ordinary Svelte template content with a real
`<strong>` element in between, never `{@html}`, computed via an
explicit reactive statement rather than inline in the template.

A contra line's amount is shown parenthesized and in red wherever it
actually falls (debit or credit) — an Asset with a credit balance, a
Liability with a debit balance, and so on: a genuinely unusual
position (an overdrawn account), not an error, but worth flagging
rather than presenting as an ordinary number. A section total (Total
Assets, Total Liabilities, Total Equity) is a single signed number but
still needs to land in the correct debit/credit column exactly like
every individual line, including the case where a whole section nets
to the unusual side (e.g. a genuine deficit — negative Total Equity,
confirmed live on real data) rather than always assuming the expected
sign. Every category starts collapsed, the same drill-down pattern
the P&L report already uses; each of the three sections (Assets/
Liabilities/Equity) gets its own independent expand state, since the
same category name could in principle appear on more than one side.

## `frontend/src/lib/components/TypedList.svelte` — the generic typed sub-list

The one generic mechanism behind every typed sub-list on an entity
(Addresses, Phone numbers, Contacts, and any future kind — spouses,
children, whatever a workplace wants to organize). Three hand-copied
components (Address/Phone/Contact) were the exact DRY violation this
consolidation eliminates: this provides the mechanism — load/save/
delete, the type-amend UI, Insert/Delete keyboard handling, selection
— once; each kind supplies only its own field shape and display via
Svelte 5 snippets, never policy baked in here.

Props include the block's legend ("Addresses", "Phone numbers",
"Contacts"), which property of `T` holds its type string
(`address_type`, `phone_type`, `contact_type`), whether the
in-progress form values are complete enough to save, a factory for a
fresh blank entry, a field-specific form-body snippet (receives the
live values object to mutate via `bind`, plus a ref-setter for the
field that should receive focus after Insert), and a field-specific
read-only display snippet for one item.

A unique id is generated per instance for its keyboard-hint text, so
the panel can announce its keyboard shortcuts to a screen reader, not
just show them visually. It reloads whenever the caller points it at
a different entity (e.g. switching which provider, customer, or
location is selected). After pressing Insert, the cursor goes straight
into the field the person will actually type into. Insert/Delete are
owned entirely by this component and attached to its own root element
(not the window), so they work correctly the moment it's used anywhere
with zero extra wiring from the parent — there are no Add/Remove
buttons at all; Insert/Delete are the only way in or out.

## `frontend/src/lib/components/TreeEditor.svelte` — the shared tree+Insert/Delete shell

The generic shell shared by every selectable-tree + Insert/Delete
screen (Business Setup and Items today — see
`docs/shared-tree-editor-component-plan.md`). It deliberately owns
nothing about what a "node" is, what kinds exist, or what Insert/
Delete should actually do for the caller's current selection — that
decision is always the caller's, since it genuinely differs per screen
(Business Setup: group → location → employee; Items: arbitrary-depth
category → item). What this component DOES own once, for every
caller: the toolbar wrapper, the ARIA wiring (`role="toolbar"`,
`tabindex`, a unique id linking the toolbar to its own keyboard-hint
text for a screen reader), the INPUT/SELECT/TEXTAREA keydown guard (so
typing into an inline add-form's fields never triggers Insert/Delete),
and translating an Insert/Delete keypress into the two generic
callbacks the caller supplies.

`<fieldset>` can never legally take an interactive ARIA role (a fixed,
implicit "group" semantic the spec won't let any role override), so
the deliberate keyboard-navigable toolbar semantics live on the inner
`<div>`, wrapping just the tree content passed in via the default
snippet. A unique id is generated per instance, so more than one
`TreeEditor` on the same page (unlikely today, but never assumed)
still links its own toolbar to its own hint text correctly.

Props: the legend text for the tree panel's fieldset; the dynamic
keyboard-hint text (computed by the caller from its current selection,
since only the caller knows what Insert/Delete will actually do);
`onInsert`/`onDelete` callbacks (the caller reads its own current
selection to decide what either means, and handles its own
confirmation/async work); and the tree content itself via the default
snippet, entirely the caller's own since node kinds and their detail
genuinely differ per screen.

## `frontend/src/routes/setup/new-business/+page.svelte` — the new-business wizard

**Prototype CoA reuse** lists existing ledgers whose Chart of Accounts
a new business can start from — confirmed to be genuinely distinct
account sets, not just different display names for the same
underlying accounts: only the five top-level report categories
(Asset/Liability/Equity/Income/Expense) are actually shared across
every business, and these leaf accounts are real, country-specific
prototypes.

**Second currency** is deliberately collapsed, optional, and off by
default, not a mandatory step: the vast majority of businesses
transact in one home currency, and a second currency is a real need
only for a business near a national border.

**Legal structure** defaults to Sole Trader, which needs no extra
setup (Owner's Equity already exists) — a business's legal structure
is largely cosmetic/reporting, since only the Balance Sheet's equity
section actually changes shape. Business types are read from the
database (the "Business Type" entity tree — Sole Trader/Partnership/
Pty Ltd Company/Incorporated Company, each with its own prototype CoA
and questions) rather than a hardcoded frontend list, and mapped to
the existing `EntityStructure` values so the backend's
`setupEquityStructure` mechanism (which creates the extra equity
accounts per structure) keeps working unchanged — additive
unification, not a rewrite of a working mechanism.

`loadPrototypeAccounts`'s own loading call was moved into the same
`onMount` already used for the sibling initial-load call, since it
previously ran as a bare top-level call that also ran during SSR,
triggering SvelteKit's "Avoid calling fetch eagerly during server-side
rendering" warning on every visit.

**Financial Year Start Date + Reporting Period**, alongside (not
replacing) the pre-existing free-text `financialYearLabel`: a real
`<input type="date">` plus an `annual`/`biannual`/`quarterly`/`monthly`
`<select>`, wired through `createBusiness`'s two new trailing optional
parameters to `setBusinessReportingPeriod` — see
`docs/pm-domain-reference.md` ("Reporting periods"). Both are optional;
leaving the date blank creates a business exactly as before, with no
stored reporting period at all.

**The post-creation bank-accounts-by-currencies wizard**, per
`docs/user-manual-ch2-configuration.md`'s "Setup then walks through
the business's own banking arrangement" section: nominate one or more
bank accounts, nominate one or more currencies, then tick exactly
which combinations actually exist. The grid shown is the full
Cartesian product as tick-boxes — only the ticked combinations
actually get built, never the full grid blindly.

## `frontend/src/lib/components/BusinessStructurePopup.svelte` and `StructureTreeNode.svelte` — the Business Structure popup

A graphical, editable view over one business's Locations, Divisions,
Item Categories, and any other generic Hierarchy, built by composing
the exact, same backend/API calls the dedicated Locations, Setup →
Hierarchies, and Items Catalog screens already use directly, not a new,
parallel mechanism. No backend changes were needed for this feature at
all: every add/move action below reuses an existing, already-wired
function.

**Presented as a step-by-step wizard, not a free-form tabbed modal**:
a `stepper` nav across the top (Locations & Divisions → Item Categories
→ Other Hierarchies), a one-line blurb per step, and Back/Next/Finish
footer buttons, instead of the earlier plain tab bar. Every single step
is explicitly optional and skippable with Next — the wizard can be
finished having added nothing at all, because a business (a sole
trader working from home, say) legitimately needs zero locations, zero
divisions, zero categories, and zero other hierarchy. `stepIndex`
drives `activeTab` (a `$derived`, not independent state) so the old
per-tab load-on-first-visit logic (`loadStep`) keeps working unchanged
under `goToStep`/`nextStep`/`prevStep`.

**The quick-add Location form now has real capacity fields**
(`bottleCapacity`/`cartonCapacity`, both optional) — previously it had
none at all, which was the actual root cause of a newly-added location
showing a storage capacity of zero: there was simply nowhere to enter
one. `parseOptionalInt` treats a blank field as `null` (no capacity
tracked for that location) rather than `0`.

**Entry points**: a "Set up your business structure" button on
`setup/new-business/+page.svelte`, shown right after creating a
business, alongside (not instead of) its existing links to the
General Journal, Entity Tree, and Locations; and a standalone
`setup/business-structure/+page.svelte` route, reachable at any later
time via a "Business Structure" entry under Configuration
(`migrateForMenuEntities`, `backend/src/db-seed.ts`), which opens the
same popup for `session.current.businessName`.

**Two distinct reposition mechanisms**, carried through the component
without being collapsed into one:

- **Locations ↔ Division membership is a hierarchy *tag***
  (`setHierarchyTag`/`deleteHierarchyTag`, `frontend/src/lib/api.ts` —
  `setHierarchyParent`/`deleteHierarchyParent` on the backend,
  `backend/src/db.ts`). A location's real `parent_id` never changes —
  it stays under the business's `Locations` root forever. "Moving" a
  location between divisions, or to "Unassigned", only changes or
  clears this tag. The Locations & Divisions tab hardcodes the
  `Division` grouping name as its one, conventional axis (the same
  convention `business-setup/+page.svelte`'s own org chart already
  assumes), and otherwise treats it as an ordinary generic hierarchy —
  "Division" has no privileged backend concept of its own.
- **Item category nesting is a real structural reparent**
  (`supersedeEntity`, `backend/src/db.ts:402`) — "moving" a category is
  a genuine change of `parent_id`, the same mechanism the Structured
  Editor's own flat-table parent dropdown already uses.

**`StructureTreeNode.svelte`** is the generic, recursive node renderer
shared by all three tabs — unlike the read-only, select-only
`HierarchyGroupTreeNode.svelte`, each node can offer an "+ Add" action
(opens a type-specific form the caller owns) and a "Move…" action
(an inline destination picker rendered by the node itself). The
component has no opinion on Locations vs Item Categories vs a generic
Hierarchy; the caller supplies `canAddChild`/`canMove` per node and the
valid move destinations, and makes no API call of its own.

**A known, pre-existing, inherited limitation, not introduced by this
feature**: `supersedeEntity`'s reparent API takes a bare parent *name*,
not a parent id, and `resolveId()` (`backend/src/db.ts:262`) resolves a
bare name with no parent scoping at all when none is given. Every
business's Items root is literally named `Items` (unique only among
siblings under the same parent, per `schema/00-core.sql`'s
`entities_name_unique` trigger), so "move to top level" is reliable
only while at most one business's `Items` root is reachable by that
bare name at once — true for this application's own single-business-
at-a-time setup today, documented directly above
`moveCategoryOptions` in `BusinessStructurePopup.svelte`, and worth
fixing in `supersedeEntity` itself (accepting a parent id) before this
popup — or the Structured Editor's own, equally-affected dropdown — is
trusted multi-business.

**Deliberately out of scope**: the popup's own quick-add Location form
has no capacity (bottle/carton) fields, unlike the dedicated Locations
screen — a location added this way can still have its capacity set
afterwards, directly on that page. `getHierarchyGroups()`
(`backend/src/db.ts:3371`) is deliberately avoided throughout (it has
no business parameter and queries globally via a `LIKE` pattern, a
cross-business data-leak risk); the popup instead always reads via the
properly business-scoped `getHierarchy(business)`.

**A real, confirmed bug fixed alongside the reshaped Chapter 3
tutorial's own mini year-end**: `createAndConfigureLocation`
(`backend/src/db.ts`) and `postLocation` (`backend/src/db-journal.ts`)
each hardcoded `asLedgerName('Actual')` when creating a new location's
capacity account — fine while a business only ever has one real
trading ledger, but silently wrong once a business has genuinely
rolled over into a new financial year and `Actual` is no longer the
live one: a location added through this popup (or the dedicated
Locations screen) *after* a rollover would have had its capacity
account misfiled into the old, closed ledger forever. Both call sites
now resolve the real, currently-active ledger first
(`getActiveLedger(businessName) ?? asLedgerName('Actual')`), falling
back to `Actual` only for a business with no Active Ledger marker yet
(impossible in practice — `createBusiness` sets one immediately — but
kept as a defensive default, matching every other `?? asLedgerName('Actual')`
fallback already used elsewhere, such as `cashPurchaseSimple` in
`backend/scripts/step-runner.ts`). Found directly: the reshaped
tutorial now rolls over into `Actual 2027-28` *before* using this
popup to add Head Office, which immediately exposed the bug.

## `frontend/src/routes/locations/+page.svelte` — Locations setup and storage actions

A refrigerated section's location entity is named with a suffix,
using the same mechanism as every other location (its own entity, its
own capacity) rather than a special field — a retail shop's cold
storage (sparkling wine, some beer) is genuinely separate real estate
from ordinary shelf space, not a subdivision of the same number.
Resolving this business's Locations parent walks the live entity tree
by id, not a constructed `"{business} Locations"` string, since
Locations is a plain, per-business-scoped name, never that mangled
form (a real regression this page previously had).

**Timezones** are the complete list of IANA identifiers from `Intl`'s
built-in database — the same data Luxon uses on the backend — not a
hand-maintained, potentially-stale subset. **Location types** are
extensible via the backend's `getLocationTypes`/`createLocationType`
mechanism (the same pattern already used for address/phone types),
fixing a previous version of this form that hardcoded only
Retail/Warehouse.

**Storage combinations** (Open Container, Convert Storage Space)
reuse the Hierarchy/Product mechanism already set up under Setup →
Hierarchies — no separate concept of their own, just two actions that
read whichever groupings a business already defined there. Opening a
container, per `docs/canned-journal-to-frontend-design.md` Phase 1,
computes its canned account selection client-side via
`openContainerLines` (see the canned-journal chapter); the backend is
only asked to resolve/create the storage-space and Inventory accounts,
with posting through the same generic staging+post calls. Opening a
container has no physical stock-quantity side effect of its own (it
only reclassifies which tier the same stock sits in), unlike
Transfer/Dispatch, so there's no separate "do the physical side
effect" call here.

**`getLocationCurrencies`**/nominated currencies (per
`docs/multicurrency-design.md`) are a location's own nominated set of
further trading currencies, alongside its implicit home currency —
nearly every location's list stays empty.

Creating a new location awaits the full create request — including
the backend's own transaction staging and posting the location's
balanced Storage Capacity accounts — before resolving, so the Form
component's submit button stays disabled for the full duration, never
resolving early.

## `frontend/src/lib/components/CashTransaction.svelte` — the shared Cash Purchase/Sale screen

This is the one real screen behind both "Cash Purchase" and "Cash
Sale": every line of difference between the two original separate
files was pure parameter-swapping (provider↔customer, Accounts
Payable↔Accounts Receivable, "Purchase"↔"Sale", receive↔dispatch) with
zero genuine structural difference, so it's one screen parameterized
by `direction`, set once by the route file that renders it
(`<CashTransaction direction="purchase" />`) and never reassigned —
a plain `const`, not a missed `$derived` (hence the `svelte-ignore
state_referenced_locally`).

**The party is fixed, not chosen.** Both Cash Purchase and Cash Sale
always post to the one real "Cash" counterparty — a Provider under
`Accounts Payable` and a Customer under `Customers`, each seeded once
(`migrateForCashCustomerAndProvider` in `backend/src/db-seed.ts`) and
never re-created. There is no vendor/customer dropdown on this screen
any more: `partyName` is a plain `const`, not state, and the party row
in the UI is a read-only label. Picking a *different*, real,
already-known provider or customer for an immediate-payment purchase
or sale is exactly what AP Purchase/AR Sale are for (see those
chapters) — Cash Purchase/Sale are deliberately narrower, for the
anonymous, walk-in case only.

**Auto-add**: as soon as every existing line has an item name filled
in (no blank line left anywhere), a fresh empty one appears at the
end — the same spreadsheet-style convention used elsewhere in this
codebase for a form of unknown length, so there's never an "Add line"
button. The effect re-fires only on that transition, not on every
keystroke: once a blank line exists, the "every line filled" check is
false until all are filled again. The auto-added trailing blank line
must never actually be sent — it's filtered out before submission,
since the backend schema correctly rejects an empty `itemName`, and
submitting it previously silently failed every purchase/sale that
reached this point with an unfilled line still present.

**Submission** goes straight to the backend's own atomic
`completeCashPurchase`/`completePosSale` (`backend/src/db.ts`, exposed
as `/pos/complete-cash-purchase`/`/pos/complete-sale`) — the same
functions the POS Terminal uses for a register sale. Each one, in a
single transaction: creates a genuine AR/AP invoice to the real "Cash"
counterparty, posts it (crediting/debiting that counterparty's own
Accounts Receivable/Payable account — never a direct-to-Cash-and-Bank
shortcut), physically dispatches/receives the stock, and then, because
a `paymentMethod` is always given here, immediately calls
`allocatePayment` to bring the balance back to zero. So a Cash
Sale/Purchase is, structurally, indistinguishable from an on-account
Sale/Purchase to the "Cash" party, right up until the instant it's
paid off — see "Cash Sale and Cash Purchase" in
`docs/pm-domain-reference.md` for the full picture, including the
diagram. The older, direct-to-Cash code paths this replaced —
`resolveCashTransactionAccounts`/`resolveSaleAccounts` and the
canned-journal `cashPurchaseLines`/`posSaleLines` they fed — have been
removed entirely, not merely stopped being called.

## `frontend/src/routes/setup/business-setup/+page.svelte` — org chart: groups, locations, employees

**The grouping hierarchy name** (used to group Locations in this
tree) is never hardcoded to "Division": it's detected by overlap with
the business's already-configured org-chart group names when any
exist, otherwise falls back to the business's first configured
hierarchy (`getHierarchy`), or the literal word "Division" only for a
brand-new business with nothing configured yet — the business is free
to use any other name just by typing it into "Add a `<name>`" the
first time. **`otherHierarchies`** are every further hierarchy
dimension the business has configured beyond that one (e.g.
"Storage", "Packaging", "Size") — one further entry field per
dimension on a Location's add/edit form, never hardcoded to any
particular name or count.

**Location creation** resolves the Locations root the same way the
backend does: the modern plain "Locations" child, with a read-only
fallback to the legacy combined `"${businessName} Locations"` root
name the one pre-existing demo business ("Wine Retail Business")
still uses — mirroring `resolveBusinessLocationsRootId` (backend/src/db.ts,
see the Entity Model chapter) client-side against the already-fetched
tree. A new location is also tagged via the Hierarchy mechanism
(`setHierarchyTag` → `setHierarchyParent`), not only the separate org-
chart relationship, since every hierarchy-driven report (Old P&L,
Stock Listing, Stock Movement, Bank Accounts, Year-End) reads that tag
— `locationHierarchyName` is always this business's own chosen name,
never hardcoded to "Division". This closes a previously-latent gap: a
location added through this page never carried the tag before, so
those reports silently showed it as ungrouped.

**Insert/Delete on the tree** extends the established pattern already
proven for addresses and phone numbers, replacing scattered "+ Add…"
link-buttons that were reported confusing. What Insert does depends on
the current selection: a group selected adds a location within it; a
location selected adds an employee at it; nothing (or an employee)
selected adds a new top-level group (the default). `handleInsert`/
`handleDelete` are the two generic callbacks `TreeEditor.svelte`
dispatches a keypress to — this page's own decision of what either
means for its current selection (group/location/employee) is kept
here, since the Items page's category/item tree needs a genuinely
different decision. `hintText` is the dynamic keyboard-hint text shown
below the tree — `TreeEditor` only renders it.

**Location detail**: this location's currently-tagged value for each
`otherHierarchies` dimension is loaded fresh via `getHierarchyTag`
whenever a location is selected, and saved back via
`setHierarchyTag`/`deleteHierarchyTag` on Save.

**Employee detail**: the "Additional locations" list tracks every
location an employee already has a schedule at, beyond their single
primary "Place of Employment" — the backend's `setEmployeeSchedule`/
`getEmployeeSchedule` already supported this per location; this was
previously a UI gap, not a backend one. Its "+ Add" is deliberately
kept as a plain link-button, not converted to the tree's Insert/Delete
pattern, since it's a secondary action inside the employee detail
panel (choosing which of several work locations to add a further
schedule for), never competing with the main tree navigation's
Insert/Delete. After saving a schedule, the employee is reloaded fresh
so `fullEmployeeSchedule` and the additional-locations list both
reflect the just-saved change rather than stale local state.

## `frontend/src/routes/items/+page.svelte` — the Items catalog tree

**Selection model**: the tree's selection is a category (any
arbitrary-depth entity under "Items" with at least one child) or an
item (a leaf). This page's former flat-list + "Category…" dropdown was
replaced with the shared `TreeEditor` idiom already proven for
Business Setup: with a category selected, Insert adds an item within
it and Delete removes whatever's selected; a plain "+ Subcategory"
link button (not Insert/Delete — the same deliberate choice made for
Business Setup's own "Additional locations") handles the secondary,
less common action of nesting a further category.

**`entities` vs. `globalEntities`**: `entities` is the business-scoped
tree (`getEntityTree(session.current?.businessName)`) the category/
item tree, `itemsRoot`, and every create/rename/reparent call on this
page work from. Manufacturers and providers are deliberately *not*
derived from it, even though both used to be: they're real, global
entities — a vendor lives once, system-wide, never nested under any
one business (see `api.ts`'s `createProvider`/`createCustomer`) — so
scoping `entities` to the business (a real, separate, earlier fix;
see the Entity Model chapter's own "`getEntityTree` business scoping"
section) silently emptied the manufacturers/providers pickers, a real
regression found only by a genuinely clean, live browser run (see
`docs/pm-testing-e2e.md`). Fixed with a second, separate, unscoped
`globalEntities` fetch (`getEntityTree()`, no business argument),
loaded alongside `entities` in the same `Promise.all`, used only by
the `manufacturers`/`providers` derived values. Any future global
root (another contact-like concern that lives once, system-wide) needs
the same treatment — never assume `entities` on this page can answer
a question that isn't genuinely scoped to the current business.

**`doReceiveIntoStorage`** receives stock directly into a named
storage combination (e.g. "Secure"), reusing the Hierarchy groupings
under Setup → Hierarchies — the same pattern the Locations page's own
Storage Actions section uses. Per `docs/canned-journal-to-frontend-design.md`
Phase 1, the physical quantity movement (`receiveIntoStorageStock`,
and for a combination-tracked receipt, the parallel units-on-hand
count) happens first, deliberately, since it's the step most likely
to fail; the canned account selection for the dollar VALUE entry
(relevant only for a combination-tracked receipt) is computed
client-side by `receiveIntoStorageLines` (see the canned-journal
chapter), with the backend asked only to resolve/create the Inventory
account.

**`itemsRoot`** works around a legacy-root naming issue also fixed on
the backend (see `resolveBusinessLocationsRootId` in the Entity Model
chapter): one pre-existing demo business ("Wine Retail Business")
seeds its Items root under a legacy combined name ("Wine Retail
Business Items"), not the modern plain "Items" child every business
created through the application gets. Without the fallback, that
business's categories were silently invisible — the scoped lookup
found nothing and the unscoped fallback resolved to the global
"Items" template root instead (id 102, parent of every business's own
copy, never a business's own data). This mirrors the backend's own
tolerant lookup (`name = 'Items' OR name LIKE '% Items'`) client-side,
against the already-fetched tree.

**`categoryTree`/`childrenByParentId`** build the nested category
tree once, by walking down from the Items root via `parent_id`
children — never by scanning the whole global tree and guessing which
nodes are "categories" from shape alone. A child is either an item
(named in the `items` list from `listItems`) or a category; an item
is always treated as a leaf here, so its own further children (e.g.
its per-location Storage Capacity structure) are never descended into
and mistaken for a nested category. A category is included even with
zero children — a genuinely new, empty subcategory is still a
category, which a naive "has at least one child" criterion would
miss. This also keeps the build O(n) overall (`childrenByParentId` is
one id→children index built once), walking only the Items subtree
rather than the whole chart-of-accounts/vocabulary/menu tree.

**`uncategorizedItems`** surfaces items that sit directly under the
Items root with no category. This used to be display-only — never
producible from this page's own Insert flow, only via older data or
the Structured Editor — even though the backend (`createItem` in
`backend/src/db.ts`) already treats a falsy/`'Items'` parent as "no
category" and always has. Per the explicit requirement that the
system must be able to operate with zero hierarchy (no categories,
divisions, or profit centers), there is now a real UI path: the
"+ Item (no category)" link button next to "+ Category" (and Insert,
when an uncategorized item is already selected) calls
**`addUncategorizedItem`**, the same pattern as
`addItemUnderCategory` but targeting the Items root directly instead
of looking up a category's id.

**`addSubcategory`**'s "+ Subcategory" link button is deliberately not
folded into Insert/Delete — the same choice made for Business Setup's
"Additional locations" — since it's a secondary action that shouldn't
compete with the main tree navigation's Insert/Delete (adding an item
within the selected category).

**`addItemUnderCategory`** calls `setItem` immediately after
`createEntity`, fixing a pre-existing bug: `listItems` requires a real
`item` table row (an INNER JOIN), so creating only the bare entity
would silently vanish a newly-added item from its own list the moment
it was created, with no error shown.

**`handleInsert`/`handleDelete`** are the two generic callbacks
`TreeEditor.svelte` dispatches an Insert/Delete keypress to; this
page's own decision of what either means for its current selection
(category vs. item) is kept here rather than pushed into the shared
shell — the same split as Business Setup's own `handleInsert`/
`handleDelete`, since a different tree genuinely needs a different
decision. `hintText` is the dynamic keyboard-hint text shown below the
tree — `TreeEditor` only renders it; this page alone knows what
Insert/Delete actually do for the current selection.

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
  (e.g. Providers), and re-navigating there would wrongly bounce that
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
