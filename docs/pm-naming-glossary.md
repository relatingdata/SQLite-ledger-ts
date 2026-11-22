# Naming Glossary

The settled domain vocabulary for this codebase — which word means
which concept. This extends the verb-prefix conventions
(`get`/`list`/`set`/`create`/`ensure`/`stage`/`post`, defined in
`docs/naming-conventions-and-entity-glossary.md`) with the domain
nouns: what's ordered and held, who's bought from, what moving stock
is called. Where an older design document uses another word, these win.

## Settled nouns

| Term | Means | Notes |
|---|---|---|
| **Item** | anything that is ordered, held, moved, sold, or assembled | replaces "goods" and "part." The finished output of an assembly is an *assembled Item*. |
| **Service** | something provided that is not held | distinct from an Item; a service today is a receipt or dispatch line without a quantity (*Domain Concepts*); there is no Services catalogue (below) |
| **Product** / **Cartesian Product** | one combination of a value from each Factor, and the set of all such combinations | always this meaning; never a synonym for Item. Cartesian Products live under the Application and under each business's own name — not a level of the item tree. |
| **Factor** | one of the things multiplied together to make a Cartesian Product | may be a single- or multi-level Hierarchy |
| **Dimension** | a Factor | `setHierarchyParent(entity, hierarchyName, parent)` places an entity within one named hierarchy; `hierarchyName` is a free-form string, deliberately not hardcoded to any specific classification |
| **Hierarchy** | a single- or multi-level reporting and naming classification | plural, **Hierarchies** |
| **Division**, **Category** | *examples* of hierarchical classifications of Locations and Items | suggested to a new business and used by the tutorials; nothing in code depends on them |
| **Save**, **Update** | labels on a UI Submit button | translatable Vocabulary words, not code verbs |
| **AR**, **AP**, **GL**, **P&L** | Accounts Receivable, Accounts Payable, General Ledger, Profit and Loss | capitalised in prose and in code (`stageARReceipt`, `postAPPayment`) |
| **Provider** | who we buy from | the term in function and type names and in the default labels. A business may relabel it (Vendor, Supplier) through the Vocabulary. The backend's field names and the `Vendors` root still say vendor (below) |
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

- **A Services catalogue.** `/goods-services` is a stub page.
- **A transfer order.** `transferItems` moves stock within one city at
  once. A transfer as a document, a dispatch and a later receipt with
  the stock in transit between, does not exist; the below-reorder
  report and the restock picking list prepare one.
- **Vendor → Provider in the backend's data names.** Function names,
  types and labels say Provider; the backend's call fields (`vendor`,
  `vendorName`, `vendor_id`, `vendor_name`) and the `Vendors` root in
  `schema/00-core.sql` still say vendor.
