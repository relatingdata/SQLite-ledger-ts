# Naming Vocabulary: what the code says, and what it should say

This chapter extends `docs/naming-conventions-and-entity-glossary.md`. That chapter defines
the **verb prefixes** (`get`, `list`, `set`, `create`, `ensure`, `stage`, `post` and so on)
and the shape of names. It does not define the **domain nouns**: which word means the thing
that is ordered, held and sold; who we buy from; what moving stock is called. Without a chosen
word for each, a new function gets whichever word its author happened to use.

**Status: a measurement, a set of settled terms, and a short list of what is still open.
Nothing has been renamed.** The terms in the next section were stated directly and are settled.
The remaining decisions are at the end, and each now carries the measured cost of making it.

## Settled vocabulary

These were stated directly, and they take precedence over anything else in this chapter or in
the earlier conventions chapter.

| Term | Means | Notes |
|---|---|---|
| **Item** | anything that is ordered, held, moved, sold, or assembled | replaces "goods" and "part". The finished output of an assembly is an *assembled Item*. |
| **Service** | something provided that is not held | **distinct from an Item.** Not folded into the Items catalogue. |
| **Product**, or **Cartesian Product** | one combination of a value from each Factor, and the set of all such combinations | **always this.** Never a synonym for Item. Cartesian Products live under the Application and under each business's name; they are not a level of the item tree. |
| **Factor** | one of the things multiplied together to make a Cartesian Product | may be a single-level or a multi-level Hierarchy |
| **Dimension** | a Factor | see the verification below |
| **Hierarchy** | a single- or multi-level reporting and naming classification | plural, **Hierarchies**, wherever a person reads it |
| **Division**, **Category** | *examples* of hierarchical classifications of Locations and Items | used by the Wine Retail Business and the Wine Tutorial Business in the user manual. Suggestions, not built in. |
| **Save**, **Update** | labels on a UI Submit button | translatable Vocabulary words, not code verbs |
| **AR**, **AP**, **GL**, **P&L** | Accounts Receivable, Accounts Payable, General Ledger, Profit and Loss | always capitalised, always with those meanings, **in code names as well as prose**. In prose the abbreviation is explained at its first use. |
| **Provider** | who we buy from | **settled, clarified: "Provider" everywhere in the code** — every type, function, and the internal contact-type key. The business owner's own, displayed label stays separately configurable (Vendor, Supplier, Provider, Purveyor, whatever fits their enterprise), via the existing, translatable Vocabulary word and its alternates — the frontend is "at the mercy of the user" choosing it, not the code. |
| **Stock** | the quantity of an Item available for sale | not the Item itself. Compare *Stocktake*, which counts it. |
| **Inventory** | the Items held at Locations | the accounting and holding view; Stock is the part of it available for sale |

**The lifecycle, in the words of the settled flow.** This is the shape the rest of the
vocabulary hangs on:

```
Order → Provider Dispatch → In Transit → Receive → Inventory
      → Transfer → Inventory
      → Dispatch → In Transit → Customer receipt
```

A **Transfer** is itself a small version of the same shape: *Location A Dispatch → In Transit →
Location B Receipt*, initiated by a **Restocking report**. Three consequences follow.

- **Dispatch is the act of leaving any origin**: a Provider, one of the business's own Locations,
  or the business itself sending to a Customer. It is *not* reserved for customers. (My earlier
  proposal to reserve it was wrong, and the collision I reported for `dispatch` dissolves: the
  word means the same thing everywhere, and what differs is the document it belongs to.)
- **Receive is the act of arriving at a destination**: a Location, or a Customer (*Customer
  receipt*, the confirmation that the order arrived).
- **In Transit is a state between the two**, and per the production design it is best modelled as
  a real place. Nothing in the code represents it today.

Because an order can hold many Items, the document for Items arriving is an **OrderReceipt**, not
an Item receipt. That leaves *AR Receipt* (money in from a customer) and *Customer receipt*
(delivery confirmed) as two further, different things, all distinguished by their qualifier.

**Dimension is already used this way in the code (verified).** `setDimensionParent(entity,
dimensionName, parent)` places an entity within one *named* hierarchy, and its own comment says it
is "deliberately NOT hardcoded to divisions or product categories: `dimensionName` is a free-form
string." That is a Factor, implemented neutrally, and it is the model for the classification
work.

### What the settled terms mean for the code

**Product has three senses in the code, and only one is right.** Measured from the names that
contain `product`:

- **Cartesian Product (correct):** `defineProductShape`, `ensureProductInstance`,
  `getBusinessProductShapes`, and the frontend's `getProductShapes` and `defineProductShape`.
- **An Item under another name (8 names):** `ensureProductSalesCogsAccounts`,
  `ensureProductInventoryAccount`, `ensureProductLocationInventoryAccount`,
  `ensureProductQuantityAccounts`, `ensureProductLocationLeaf`, `ensureProductTierItem`,
  `ensureProductTierLocationLeaf` and `getProductUnitCostMinor`. Each takes an item name, so each
  should say Item. (`ensureProductTierItem` even takes a `baseProductName` typed `ItemName`.)
- **A level of the item tree (about ten names):** `listProducts`, `createProduct`,
  `ProductSummary`, `getItemProduct`, `setItemProduct`, `productsRouter`, and the fixtures
  `products.csv`, `DemoProduct` and `loadDemoProducts`. Under this vocabulary that level should not
  be called Product, and `docs/entity-model.md` describes the tree as `Category → Product →
  Item`. Because Category is only an *example* classification, the whole `Category → …` skeleton
  is hardwired classification, which is the largest item in
  `docs/classification-neutrality-impact.md` (Tier 4a).

**An earlier chapter used "Product" differently.** `docs/item-terminology-and-storage-design-notes.md`
records that a Part is for assembly and a Product is "something finished, as in output." Under
the settled terms a finished output is an *assembled Item*, and Product never means that. That
chapter also sat **outside the manual**: it was not registered in the manual builder. It is
registered now.

**AR and AP are not capitalised in names (measured), and the rule now covers names.** `AR`
appears in 8 names and `AP` in 8; none is capitalised. Seven use `Ar` (`ArSaleInput`,
`stageArSale`), one uses `ar` (`arApRouter`), and all eight AP names use `Ap`
(`ApPurchaseInput`, `stageApPurchase`). `GL` appears in no name. P&L cannot appear in a name, and
12 names spell it `ProfitAndLoss`, which is the right spelling. It has been stated that the
capitalisation applies **in code as well as prose**, so these names need changing. Measured:
**28 identifiers, 241 lines, 21 files**. The earlier figure of 16 counted *exported* names only;
this count also includes local variables (`arNode`, `arLines`, `fullPayApInvoiceId`) and names
that appear only in documentation (`ArReceipt`, `ApPurchase`). That is a contained rename.

**The prose rule needs a measurement of its own.** The abbreviation is explained the first time it
is used in each piece of prose ("Accounts Receivable (AR)"). Whether the existing documents do
this has **not been measured**; it would be a check that the first line using AR, AP, GL or P&L
also carries the expansion.

**`receipt` is settled by the flow.** `ArReceipt` is the accounting meaning (an AR receipt is a
payment received against a receivable). Items arriving against an order are an **OrderReceipt**,
because an order holds many Items, so `StockReceipt` becomes `OrderReceipt` rather than an Item
receipt. *Customer receipt* is a third thing, the delivery confirmed. The qualifier tells them
apart.

**"Goods" is retired, and Services are distinct.** It appears in no exported name, but in 13
lines of 7 hand-written documents. The ones in this session's chapters and in the user manual
glossary's definition of Income are fixed. The rest is one real name: a **`/goods-services`
screen** (`frontend/src/routes/goods-services/`), an unimplemented "Goods & Services (dedicated
catalog)" stub that the first analysis missed because it read exported names, not routes. Since a
Service is **distinct from an Item**, the answer is not to fold it into the Items catalogue: the
stub becomes a **Services** catalogue of its own, and the word "goods" goes.

**Save and Update are not in the verb problem.** I had counted three `save…` and three `update…`
names as synonyms of `set`. Since Save and Update are UI Submit labels, the only question is
whether a *code* name borrows a UI word. The candidates are `saveLocation`,
`saveBusinessTypeAnswers` and `updateEntity`; where each is used has not been checked.

## How it is measured

`make analyze-vocabulary` tokenises every exported name in `backend/src` and
`frontend/src/lib` into words (`transferStock` → `transfer`, `stock`) and reports which words
are in use for each concept. It writes `docs/naming-vocabulary-analysis.md`, which is
**generated and deliberately not part of this manual**, so the names in its tables are not
counted as documentation by the coverage check.

Limits, stated because they change how much to trust it: it is a **word-level heuristic**, not
an understanding of meaning. The groups of words that "mean the same thing" are my own list, in
`scripts/analyze-vocabulary.ts`. It sees exported names only. A word appearing in a name does
not prove the code means what the word suggests, so every finding below says whether the
*count* is measured or the *meaning* is inferred. Some flagged variation is deliberate.

## What it found

Scanned 666 distinct exported names, 490 of them functions.

### Verbs

- **Only 298 of 490 functions (61%) start with a verb the conventions define.** 102 different
  first words are in use, and only 15 are defined. Measured.
- **Much of that is not a real problem.** `type…` (38, type descriptors), `as…` (11, brand
  casts such as `asUserId`) and the `…Router` constants that start with a noun (`stock…`,
  `customer…`, `menu…`) are not verbs at all.
- **Some undefined verbs are the lifecycle itself.** `dispatch`, `receive`, `transfer`,
  `place`, `fulfill`, `record`, `confirm`, `allocate` and `nominate` are in use and have no
  stated meaning. These are the words you named as fundamental, so they most need defining.
- **Some verbs are synonyms of defined ones.** Measured: `fetch` (4) beside `get` (132), and
  `register` (2) and `add` (7) beside `create` (26). Whether each pair is a *different*
  operation or the same one under two names has to be checked one at a time. (`save` and
  `update` are not in this list: they are UI Submit labels, see "Settled vocabulary".)

### `fetch` is a real hazard, not a style point

**Verified by reading it.** `fetch(name, type, parent)` in `backend/src/db.ts` **throws** when
the entity is missing and also checks its type. The conventions define `get` as "returns
`undefined` if not found." So `fetch` is a third meaning, "get or throw, typed", under a name
that is also the platform's own network call. It is used throughout the backend. A reader who
knows `get` will expect a missing entity to come back as `undefined`.

### Nouns

| Concept | Words in use (names containing the word) | How sure |
|---|---|---|
| the thing ordered, held, sold | `stock` 39, `item` 30, `product` 16, `inventory` 2 | count measured; `product` is settled (see above), `stock` is open |
| who we buy from | `vendor` 4, and `source` in `item_source` | measured. **Your word is *supplier*.** |
| who we sell to | `customer` 12 | consistent |
| a place | `location` 44 | consistent; `warehouse`, `outlet` and the like appear only as location *types* |
| people who work | `employee` 14 | consistent |
| a way of grouping | `division` 18, `hierarchy` 14, `category` 9, `dimension` 7, `tier` 2, `group` 1 | count measured. `dimension` is consistent with a Factor (verified); `division` and `category` are examples, not concepts |
| how many | `quantity` 5, `count` 5, `units` 1 | measured |

**The place concept is clean, which matters:** `location` is the only word used, so the
principle that Locations are real is already honoured in the names.

**`product` is the largest correction to this chapter's first version.** I had written that
`product` and `item` were "partly deliberate" because the item tree has a Product level. That
was wrong: Product means Cartesian Product and nothing else. The three senses in the code, and
which need renaming, are set out under "Settled vocabulary".

**`tier` (2 names) is not yet placed.** `ensureProductTierItem` and
`ensureProductTierLocationLeaf` use it for the pack level of an item (bottle, carton). Whether a
tier is a value of a Factor, or something else, was not checked.

**`stock` is doing two jobs.** It names the movement forms (`StockReceiptInput`,
`stageStockReceipt`, `postStockReceipt`, `StockDispatchInput`) and the movement functions
(`receiveStockAtLocation`, `transferStock`, `writeOffStock`), and it is also part of the file
name `db-stock.ts` and the `Stock Take` entity.

### Words that mean two different things

These were the finds I first thought mattered most. The lifecycle you gave resolves the first
three, and they are kept here so the reasoning is visible. The counts are measured; the
meanings were **inferred from the names**.

- **`receipt`: resolved.** `ArReceiptInput` / `postArReceipt` are the accounting meaning (money in
  from a customer); `StockReceiptInput` / `postStockReceipt` are Items arriving, which becomes
  **OrderReceipt**. The qualifier distinguishes them.
- **`dispatch`: resolved, and my earlier proposal was wrong.** It appears in
  `dispatchStockFromLocation` and `dispatchOrderFromPickingList` (sending to a customer) and in
  `dispatchRestockFromPickingList` (moving between the business's own locations). I proposed
  reserving it for customers. The lifecycle shows that **Dispatch means leaving any origin**, so
  using one word for all of these is correct; what needs naming is the *document* each belongs
  to (see "The lifecycle and what to call each step").
- **`restock` and `transfer`:** both name moving Items between Locations, `restock` in five names
  and `transfer` in two. In the flow a **Restocking report initiates a Transfer**, so `restock` is
  the *reason* and *Transfer* is the operation.
- **`count`** is a verb in `countJournalEntries` (how many rows) and a noun in
  `recordStockTakeCount` (a quantity someone counted). Still open, and minor.
- **`post`** is defined as committing to the ledger, but `postLocation` and
  `postBomComponents` create an entity and a link. This is the stage-and-post pattern applied to
  every form, so it is deliberate, but the definition should say so.

### Smaller things

- **`sales` 10 versus `sale` 9**, and **`purchase` 10** beside `ApPurchase`: these split along
  document names (`SalesOrder`) versus the AR/AP prefixes (`ArSale`). Probably fine.
- **`bom` versus `assembly`**: the functions say `Bom`, the screen route says `assembly-bom`,
  the staging table says `assembly_bom_staging`. These are two things, the recipe and what is
  made from it, so this may be correct. It should be written down.
- **No spelling variants** were found (`fulfill` is used once, never `fulfil`).
- **An existing example is stale.** `naming-conventions-and-entity-glossary.md` gave
  `CapTest Outlet — Storage Capacity Remaining` as an example of the per-location account
  pattern. Storage capacity is now a nested `Storage Capacity` → `Remaining` structure and no
  longer follows that pattern. Corrected in that chapter.

## Names that follow from the settled terms

| Word | Means | Notes |
|---|---|---|
| **Location** | any real place Items are held, including a factory, a warehouse, and Items in transit | `warehouse`, `outlet`, `site` stay as location *types*, which are data |
| **Provider** | who we buy from, whether of Items or of Services | **proposed for code.** "Supplier" and "Vendor" stay as translatable Vocabulary labels that a person reads. Measured: nothing in the code is named `provider` (no declaration, heading or identifier), so it collides with nothing. |
| **Customer** | who we sell to | `client`, `buyer` are not used |
| **Stock** | the quantity of an Item available for sale | see the settled table |

**Lifecycle verbs**, each with one meaning:

| Verb | Means | Document |
|---|---|---|
| **order** | commit to buy, sell or move, before anything moves | PurchaseOrder (to a Provider), SalesOrder (from a Customer), TransferOrder (between own Locations) |
| **dispatch** | Items leave an origin: a Provider, one of the business's Locations, or the business itself | |
| **receive** | Items arrive at a destination: a Location or a Customer | OrderReceipt (Items, against an order), *Customer receipt* (delivery confirmed) |
| **transfer** | the whole journey between own Locations: Dispatch, In Transit, Receive | TransferOrder, initiated by a Restocking report |
| **write off** | Items are lost | |
| **produce** | components are consumed and an assembled Item is made | not built yet |

**Retire or define:** `fetch` (explained below); `register` (fold into `create`, or define);
`StockReceipt` (becomes `OrderReceipt`); and `restock`, which is the *reason* for a Transfer, not
a separate operation. `save` and `update` are not on this list: they are UI labels and stay as
translatable Vocabulary words.

## `transferItems` or `TransferOrder`? Both, at different levels

Asked as "`transferItems`? `TransferOrder`? compare the flow." The flow answers it. There are two
levels, and the code conflates them:

- **The document** is an **order**, like the two that already exist: a PurchaseOrder to a
  Provider, a SalesOrder from a Customer, and a **TransferOrder** between the business's own
  Locations, initiated by a Restocking report. An order holds many Items.
- **The events** are **dispatchItems** (Items leave an origin) and **receiveItems** (Items arrive
  at a destination), with **In Transit** between them.
- **`transferItems`** then remains as the name for the *whole journey* when it is instant: a
  Dispatch and a Receive at once, at one site, with nothing in transit.

Today's names map onto that as follows. Two of the rows do not exist yet:

| Today | Under the vocabulary | Exists today? |
|---|---|---|
| `transferStock` | `transferItems` | yes, instant only, same city only |
| `receiveStockAtLocation` | `receiveItems`, posting an OrderReceipt | yes |
| `dispatchStockFromLocation` | `dispatchItems` | yes |
| `writeOffStock` | `writeOffItems` | yes |
| `getRestockPickingList`, `dispatchRestockFromPickingList`, `confirmRestockPickedLine` | picking and dispatch against a **TransferOrder** | yes, but there is no order document behind them |
| a TransferOrder | a document, with its own staging table like every form | **no** |
| In Transit | a real place between Dispatch and Receive | **no** |
| `stageStockReceipt` / `postStockReceipt` | `stageOrderReceipt` / `postOrderReceipt` | yes |

**Not verified:** whether the existing below-reorder report and restock picking list together are
the "Restocking report" of the flow, or whether that is a separate thing still to build.

### What each rename would cost (measured with `make find-uses`)

| Rename | Names | Lines | Files | Note |
|---|---|---|---|---|
| the movement family (row 1 to 5 above, plus the stage/post forms and inputs) | 14 | 443 | 46 | about 170 of the lines are in the docs |
| `Ar`/`Ap`/`ar` to `AR`/`AP` | 28 | 241 | 21 | includes local variables and documentation-only names |
| the eight item-sense `ensureProduct…` names to `ensureItem…` | 8 | 167 | 28 | |
| **Vendor to Provider** | **35** | **1,074** | **111** | by far the largest; includes tests and screenshot names |
| `fetch` | 3 | 494 | 52 | noisy: the word also appears in prose and as the platform call |

Every rename here is mechanical and can be checked by the full test suite, and each is far
cheaper than it looks in the abstract. The Provider rename is the exception, at over a thousand
lines, and should be decided with that number in view.

**One collision to settle.** The file `db-stock.ts` would follow the movement family, but
`db-items.ts` would collide with `routes/items.ts` and the item catalogue. The file is about
holding and moving Items, not about the catalogue.

## `fetch`, explained

Asked to explain. `fetch(name, type, parent)` is defined in `backend/src/db.ts`. It does three
things, all **verified by reading it**:

1. it looks a name up in the entity tree, scoped to a parent when one is given;
2. it **throws** `No entity named "X"` if there is none;
3. if there is one, it checks the name really is that *type* (so a business name cannot be passed
   where a ledger name is expected) and returns a small typed handle, `{ id, name }`.

It is used to walk down the tree, where every step must exist:
`fetch('Chart of Accounts', typeRootName, fetch(business, typeBusinessName, fetch('Businesses', typeRootName)))`.

**Why the name is a problem, stated honestly.** The conventions define `get` as a read-only query
that returns `undefined` when nothing is found. `fetch` looks like a `get` but throws, so a reader
who knows the convention will expect the wrong behaviour. The second problem is smaller than I
first claimed: `fetch` is also the platform's own network call. In practice TypeScript would
reject a mistaken HTTP call, because the argument types differ, so this is a matter of *reading*,
not a hidden runtime trap. I overstated it earlier by calling it a hazard.

**What to call it.** The conventions already use a `require` prefix for "must be true, otherwise
throw" (`requireAuth`, `requireRole`). `fetch` is exactly that, for an entity, so
**`requireEntity`** fits an existing convention instead of adding a new word. The same applies to
`fetchById` (`requireEntityById`) and `fetchGlobalCoaCategory`. The cost is the 494 lines in 52
files above. The cheapest alternative is to leave the name and write its behaviour into the
conventions chapter. **Not verified:** how many of the 132 `get…` functions really return
`undefined` when nothing is found, as the convention says; only `fetch` was checked.

## Decisions needed

**Settled by your answers, no longer open:** that Product means only a Cartesian Product, and
that Cartesian Products live under the Application and under each business's name, not in the item
tree; that a Dimension is a Factor; that Division and Category are examples; that Save and Update
are UI labels; that "goods" becomes Items; that Services are distinct from Items; that AR, AP, GL
and P&L are capitalised in code and in prose, with the abbreviation explained at first use; that
a receipt for Items is an OrderReceipt; that Stock is the quantity of an Item available for sale;
the lifecycle and what Dispatch, Receive and Transfer mean; and that a naming check should become
a gate, "if not immediate, certainly eventually."

1. **TransferOrder as a new document.** Confirm the model above: a TransferOrder (with its own
   staging table), the events `dispatchItems` and `receiveItems` with In Transit between, and
   `transferItems` kept for the instant same-site case. Building it is separate from renaming.
2. **Provider.** Confirm it as the code term, at a cost of 1,074 lines in 111 files. And what
   happens to `item_source`, the table of a Provider's offer for an Item (price, pack size, lead
   time)?
3. **`fetch`.** Rename to `requireEntity`, or leave it and document it?
4. **The `/goods-services` stub.** Since Services are distinct from Items, replace it with a
   **Services** catalogue. That needs design of its own: what a Service records, and whether one
   can be a line on an assembly (see the production design).
5. **The movement file's name**, given the collision with the items catalogue.
6. **The first version of the naming check:** as a report first, then a gate once the renames
   above have landed, so it does not fail on names that are about to change.

## Not verified

Whether `register` differs in behaviour from `create`; whether `tier` is a value of a Factor;
where `saveLocation`, `saveBusinessTypeAnswers` and `updateEntity` are used and whether a code
name is borrowing a UI word; whether the existing reports are the Restocking report of the flow;
how many `get…` functions return `undefined` when nothing is found; whether the AR, AP, GL and P&L
first-use rule is followed in the existing documents; and the frontend Svelte files (the analysis
reads `.ts` exports, and routes only by hand).
