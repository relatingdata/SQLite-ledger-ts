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
