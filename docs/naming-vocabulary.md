# Naming Vocabulary: what the code says, and what it should say

This chapter extends `docs/naming-conventions-and-entity-glossary.md`. That chapter defines
the **verb prefixes** (`get`, `list`, `set`, `create`, `ensure`, `stage`, `post` and so on)
and the shape of names. It does not define the **domain nouns**: which word means the thing
that is ordered, held and sold; who we buy from; what moving stock is called. Without a chosen
word for each, a new function gets whichever word its author happened to use.

**Status: a measurement, a set of settled terms, and a draft for what is still open. Nothing
has been renamed.** The terms in the next section were stated directly and are settled. The
remaining decisions are at the end, starting with `transferItems`.

## Settled vocabulary

These were stated directly, and they take precedence over anything else in this chapter or in
the earlier conventions chapter.

| Term | Means | Notes |
|---|---|---|
| **Item** | anything that is ordered, held, moved, sold, or assembled | replaces "goods" and "part". The finished output of an assembly is an *assembled Item*. |
| **Product**, or **Cartesian Product** | one combination of a value from each Factor, and the set of all such combinations | **always this.** Never a synonym for Item. |
| **Factor** | one of the things multiplied together to make a Cartesian Product | may be a single-level or a multi-level Hierarchy |
| **Dimension** | a Factor | see the verification below |
| **Hierarchy** | a single- or multi-level reporting and naming classification | plural, **Hierarchies**, wherever a person reads it |
| **Division**, **Category** | *examples* of hierarchical classifications of Locations and Items | used by the Wine Retail Business and the Wine Tutorial Business in the user manual. Suggestions, not built in. |
| **Save**, **Update** | labels on a UI Submit button | translatable Vocabulary words, not code verbs |
| **AR**, **AP**, **GL**, **P&L** | Accounts Receivable, Accounts Payable, General Ledger, Profit and Loss | always capitalised, always with those meanings |

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

**AR and AP are not capitalised in names (measured).** `AR` appears in 8 names and `AP` in 8;
none is capitalised. Seven use `Ar` (`ArSaleInput`, `stageArSale`), one uses `ar` (`arApRouter`),
and all eight AP names use `Ap` (`ApPurchaseInput`, `stageApPurchase`). `GL` appears in no name.
P&L cannot appear in a name, and 12 names spell it `ProfitAndLoss`, which is the right spelling.
Whether the capitalisation rule also applies to names in code, or only to prose and the UI, needs
your answer (decision 5).

**`receipt` is less ambiguous than I first said.** `ArReceipt` uses the accounting meaning (an
AR receipt is a payment received against a receivable) and is unambiguous once AR is capitalised.
What remains is `StockReceipt`, which is Items arriving.

**"Goods" is retired.** It appears in no exported name, but in 13 lines of 7 hand-written
documents. The ones in this session's chapters and in the user manual glossary's definition of
Income are fixed. The rest is one real name: a **`/goods-services` screen**
(`frontend/src/routes/goods-services/`), an unimplemented "Goods & Services (dedicated catalog)"
stub that the first analysis missed because it read exported names, not routes. It duplicates the
existing Items catalogue and needs a decision (decision 6).

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

These are the finds that matter most, because a reader cannot tell which meaning is intended.
The counts are measured; the meanings are **inferred from the names**.

- **`receipt`** appears in `ArReceiptInput` / `stageArReceipt` / `postArReceipt` and also in
  `StockReceiptInput` / `stageStockReceipt` / `postStockReceipt`. An AR receipt is, in
  accounting, **money coming in from a customer**; a stock receipt is **Items coming in from a
  supplier.** The AR prefix carries the accounting meaning, so this is a smaller problem than it
  first looked; it is a question of what to call the second one (decision 4).
- **`dispatch`** appears in `dispatchStockFromLocation` and `dispatchOrderFromPickingList`
  (sending to a customer) and in `dispatchRestockFromPickingList` (moving stock between the
  business's own locations). You named *moving or redistributing* and *dispatching to
  customers* as separate fundamentals; the code uses one word for both.
- **`restock` and `transfer`** both name moving stock between locations: `restock` in five
  names, `transfer` in two.
- **`count`** is a verb in `countJournalEntries` (how many rows) and a noun in
  `recordStockTakeCount` (a quantity someone counted).
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

## A draft vocabulary

**A draft, for decision.** Nothing below is in force.

**Nouns**

| Word | Means | Instead of |
|---|---|---|
| **Item** | *(settled)* the thing that is ordered, held, moved, sold, and assembled | `stock` as a noun for the thing, `goods`, `part`, and every use of `product` that means an item |
| **Location** | any real place items are held, including a factory, a warehouse, and items in transit | `warehouse`, `outlet`, `site` (these stay as location *types*, which are data) |
| **Supplier** *or* **Vendor** | who we buy from | see decision 2 |
| **Customer** | who we sell to | `client`, `buyer` |
| **Stock** | a quantity of an item held at a location ("stock level", "stock take") | the thing itself |

**Lifecycle verbs**, each with one meaning (draft, for decision):

| Verb | Means |
|---|---|
| **order** | commit to buy or sell, before anything moves |
| **receive** | items arrive at a location from a supplier |
| **transfer** | items move between locations of the same business, at any distance |
| **dispatch** | items leave to a customer |
| **write off** | items are lost |
| **produce** | components are consumed and an assembled item is made |
| **count** | verb only: how many rows; the noun is a *stock count* |

**Retire or define**: `fetch` (rename, and stop shadowing the platform name); `register` (fold
into `create`, or define); `restock` (a *reason* for a transfer, not a separate operation); and
`StockReceipt`, which should say Item. `save` and `update` are not on this list: they are UI
labels and stay as translatable Vocabulary words.

## The `transferItems` question

You asked to refer to `transferItems`. Under this vocabulary that is the right name: **transfer**
is the lifecycle verb and **Items** is the settled noun. But `transferStock` has siblings, and
renaming one would create the very inconsistency this chapter measures:

| Today | Under the vocabulary |
|---|---|
| `transferStock` | `transferItems` |
| `receiveStockAtLocation` | `receiveItems` |
| `dispatchStockFromLocation` | `dispatchItems` |
| `writeOffStock` | `writeOffItems` |
| `dispatchRestockFromPickingList` | a `transfer…` name, since it moves between own locations |
| `stageStockReceipt` / `postStockReceipt` | `stageItemReceipt` / `postItemReceipt` |
| `ensureProduct…Account` and the other item-sense `Product` names (8) | `ensureItem…Account` and so on |
| `stageArSale`, `ArReceiptInput`, `stageApPurchase` and the other AR/AP names (16) | `AR`/`AP` capitalised, if the rule applies to names (decision 5) |

**One collision to settle first.** The file `db-stock.ts` would become `db-items.ts`, but
`routes/items.ts` and the item catalogue already own "items". The movement code is about
*holding and moving* items, not about the catalogue.

The rename would **likely** touch the backend, the frontend API wrappers, the Svelte pages, the
tests, the Step Runner registry and the manual (no count has been taken), so it should be one
tool-assisted, verified step with the full test suite as proof, not a series of edits. It has
not been started.

## Decisions needed

Answered by your clarifications, and no longer open: whether `product` keeps a structural
meaning (no: Product is the Cartesian Product), what a dimension is (a Factor), whether Division
and Category are concepts (no: examples), whether Save and Update are verbs (no: UI labels), and
the word for items (Item, not goods).

1. **`transferItems` and its family.** Rename the whole family together (table above), or only
   `transferStock`? Renaming one alone creates the inconsistency this chapter measures.
2. **Supplier or vendor?** You say *supplier*; the code says *vendor* (4 names plus `source`
   in `item_source`). Renaming `VendorName`, `asVendorName` and the rest touches many files.
3. **What replaces the Product level in the item tree**, now that it cannot be called Product?
   This is bound up with removing the hardwired `Category → … → Item` skeleton
   (`docs/classification-neutrality-impact.md`, Tier 4a), so it may be that the level simply goes
   away and items are classified by Hierarchies.
4. **`StockReceipt`:** call it an Item Receipt?
5. **Does the AR/AP/GL capitalisation rule apply to names in code** (`stageARSale`,
   `ARReceiptInput`), or only to prose, the UI and documentation? In code the names currently use
   `Ar` and `Ap`.
6. **The `/goods-services` screen:** remove it, or fold it into the Items catalogue with a
   service as a kind of Item? It is an unimplemented stub.
7. **`dispatch`:** reserved for customers, with movements between own locations called
   `transfer`?
8. **`fetch`:** rename it, and to what? It throws when missing, unlike `get`.
9. **Should a naming check be a gate,** like `check-unused`? Several rules are now settled
   (no "goods", Product only as Cartesian Product, capitalised acronyms), so a first version is
   possible, but it needs decisions 4 and 5 first.

## Not verified

Whether `register` differs in behaviour from `create`; whether `tier` is a value of a Factor;
where `saveLocation`, `saveBusinessTypeAnswers` and `updateEntity` are used and whether a code
name is borrowing a UI word; the frontend Svelte files (the analysis reads `.ts` exports, and
routes only by hand); and how many places a family rename would touch (no count has been taken).
