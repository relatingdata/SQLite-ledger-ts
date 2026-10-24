# Naming Glossary

The settled domain vocabulary for this codebase — which word means
which concept. This extends the verb-prefix conventions
(`get`/`list`/`set`/`create`/`ensure`/`stage`/`post`, defined in
`docs/naming-conventions-and-entity-glossary.md`) with the domain
nouns: what's ordered and held, who's bought from, what moving stock
is called. These terms take precedence over any other name found
in older design documents.

## Settled nouns

| Term | Means | Notes |
|---|---|---|
| **Item** | anything that is ordered, held, moved, sold, or assembled | replaces "goods" and "part." The finished output of an assembly is an *assembled Item*. |
| **Service** | something provided that is not held | distinct from an Item — not folded into the Items catalogue (the dedicated Services catalogue is not yet built — see Not Yet Built, below) |
| **Product** / **Cartesian Product** | one combination of a value from each Factor, and the set of all such combinations | always this meaning; never a synonym for Item. Cartesian Products live under the Application and under each business's own name — not a level of the item tree. |
| **Factor** | one of the things multiplied together to make a Cartesian Product | may be a single- or multi-level Hierarchy |
| **Dimension** | a Factor | `setDimensionParent(entity, dimensionName, parent)` places an entity within one named hierarchy; `dimensionName` is a free-form string, deliberately not hardcoded to any specific classification |
| **Hierarchy** | a single- or multi-level reporting and naming classification | plural, **Hierarchies** |
| **Division**, **Category** | *examples* of hierarchical classifications of Locations and Items | used by the bundled demo businesses; suggestions, not built-in concepts |
| **Save**, **Update** | labels on a UI Submit button | translatable Vocabulary words, not code verbs |
| **AR**, **AP**, **GL**, **P&L** | Accounts Receivable, Accounts Payable, General Ledger, Profit and Loss | capitalised in prose; in code, names still spell these `Ar`/`Ap` (lowercase-leading) rather than `AR`/`AP` — a known, not-yet-applied rename (see Not Yet Applied, below) |
| **Provider** | who we buy from | the one, canonical term — in code (every type/function/contact-type key) and in the default user-facing label alike. "Vendor"/"Supplier"/"Purveyor" are not competing standard terms; a business may still relabel the screen to one of them (or any word it prefers) via the translatable Vocabulary mechanism, but that is an opt-in customization, not the default |
| **Customer** | who we sell to | |
| **Stock** | the quantity of an Item available for sale | not the Item itself — compare *Stocktake*, which counts it |
| **Inventory** | the Items held at Locations | the accounting/holding view; Stock is the part of it available for sale |
| **Location** | any real place Items are held, including a factory, a warehouse, or Items in transit | `warehouse`/`outlet`/`site` are location *types* (data), not separate code concepts |

## The lifecycle, in the words of the settled flow

```
Order → Provider Dispatch → In Transit → Receive → Inventory
      → Transfer → Inventory
      → Dispatch → In Transit → Customer receipt
```

A **Transfer** is itself a small version of the same shape: *Location
A Dispatch → In Transit → Location B Receipt*, initiated by a
Restocking report.

| Verb | Means | Document |
|---|---|---|
| **order** | commit to buy, sell or move, before anything physically moves | PurchaseOrder (to a Provider), SalesOrder (from a Customer) |
| **dispatch** | Items leave an origin — a Provider, one of the business's own Locations, or the business itself | not reserved for sending to a customer; the same word applies wherever something leaves an origin |
| **receive** | Items arrive at a destination — a Location, or a Customer | **OrderReceipt** (Items, against an order — not "Item receipt," since one order holds many Items); *Customer receipt* is the separate, distinct confirmation that a delivery arrived |
| **transfer** (`transferItems`) | the whole Location-to-Location journey, when instant — a Dispatch and a Receive at one site, nothing genuinely in transit | implemented today for same-city transfers only |
| **write off** | Items are lost | `writeOffItems` |

Because an order can hold many Items, the document for Items arriving
is an **OrderReceipt**, never an "Item receipt." *AR Receipt* (money
in from a customer) and *Customer receipt* (delivery confirmed) are
two further, distinct things from OrderReceipt — each told apart by
its qualifier, never by the bare word "receipt" alone.

## Not yet built

- **A Services catalogue of its own.** The `/goods-services` route is
  a confirmed stub. Since a Service is distinct from an Item, the
  plan is a dedicated Services catalogue, not folding Services into
  the Items catalogue — not yet designed or built.
- **TransferOrder as a real document.** Today, `transferStock` covers
  only the instant, same-city case. A genuine, multi-step transfer (a
  real document with its own staging table, the events `dispatchItems`
  and `receiveItems` with a real "In Transit" place between them) is
  not yet built; the existing below-reorder report and restock
  picking list are a step toward it, not the thing itself.
- **A `fetch`-prefixed function family that behaves like `require`,
  not `get`.** `fetch(name, type, parent)` (`backend/src/db.ts`)
  throws when the entity is missing and checks its type — behavior
  that matches this codebase's own `require*` convention
  (`requireAuth`, `requireRole`), not its `get*` convention (returns
  `undefined` when missing). The function has not been renamed; a
  reader expecting ordinary `get*` behavior should know `fetch` is the
  one, deliberate exception.
- **`AR`/`AP` capitalisation in code identifiers.** Settled in prose;
  not yet applied to the ~28 code identifiers that still spell these
  `Ar`/`Ap` (`ArSaleInput`, `stageArSale`, `arApRouter`, and similar).
- **Vendor → Provider, applied to code naming and the frontend's
  user-facing labels** (menu, screen legends, local component
  variables — per direct instruction). Not yet applied to the
  backend's own request/response field names and SQL column names
  (`vendor`, `vendor_name`, `vendor_id` in `db.ts`, `db-journal.ts`,
  `db-stock.ts`, the `routes/*.ts` zod schemas, and the
  `po_staging`/`ap_payment_staging`/`item_source` tables) — a larger,
  schema-touching rename, deferred separately from the naming-only
  work above.