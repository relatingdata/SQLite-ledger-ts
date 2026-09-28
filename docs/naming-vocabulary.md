# Naming Vocabulary: what the code says, and what it should say

This chapter extends `docs/naming-conventions-and-entity-glossary.md`. That chapter defines
the **verb prefixes** (`get`, `list`, `set`, `create`, `ensure`, `stage`, `post` and so on)
and the shape of names. It does not define the **domain nouns**: which word means the thing
that is ordered, held and sold; who we buy from; what moving stock is called. Without a chosen
word for each, a new function gets whichever word its author happened to use.

**Status: a measurement and a draft. Nothing has been renamed.** The draft vocabulary needs
your decisions (section 5), starting with the one you raised: `transferItems`.

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
- **Some verbs are synonyms of defined ones.** Measured: `fetch` (4) beside `get` (132);
  `save` (3) and `update` (3) beside `set` (41); `register` (2) and `add` (7) beside `create`
  (26). Whether each pair is a *different* operation or the same one under two names has to be
  checked one at a time.

### `fetch` is a real hazard, not a style point

**Verified by reading it.** `fetch(name, type, parent)` in `backend/src/db.ts` **throws** when
the entity is missing and also checks its type. The conventions define `get` as "returns
`undefined` if not found." So `fetch` is a third meaning, "get or throw, typed", under a name
that is also the platform's own network call. It is used throughout the backend. A reader who
knows `get` will expect a missing entity to come back as `undefined`.

### Nouns

| Concept | Words in use (names containing the word) | How sure |
|---|---|---|
| the thing ordered, held, sold | `stock` 39, `item` 30, `product` 16, `inventory` 2 | count measured; meaning partly deliberate, see below |
| who we buy from | `vendor` 4, and `source` in `item_source` | measured. **Your word is *supplier*.** |
| who we sell to | `customer` 12 | consistent |
| a place | `location` 44 | consistent; `warehouse`, `outlet` and the like appear only as location *types* |
| people who work | `employee` 14 | consistent |
| a way of grouping | `division` 18, `hierarchy` 14, `category` 9, `dimension` 7, `tier` 2, `group` 1 | count measured; see the classification chapter |
| how many | `quantity` 5, `count` 5, `units` 1 | measured |

**The place concept is clean, which matters:** `location` is the only word used, so the
principle that Locations are real is already honoured in the names.

**`product` and `item` are partly deliberate.** Per the item chapters, an item tree is
`Category → Product → Item`, so *product* is a real level and not merely a synonym. The names
`getItemProduct` and `setItemProduct` are the link between the two levels, which is correct.
The confusion is in the types: `ensureProductTierItem(baseProductName: ItemName, …)` takes a
*product* name typed as an `ItemName`, and `ensureProductInventoryAccount` takes an item name
but is named for a product. The distinction exists in the model and is blurred in the code.

**`stock` is doing two jobs.** It names the movement forms (`StockReceiptInput`,
`stageStockReceipt`, `postStockReceipt`, `StockDispatchInput`) and the movement functions
(`receiveStockAtLocation`, `transferStock`, `writeOffStock`), and it is also part of the file
name `db-stock.ts` and the `Stock Take` entity.

### Words that mean two different things

These are the finds that matter most, because a reader cannot tell which meaning is intended.
The counts are measured; the meanings are **inferred from the names**.

- **`receipt`** appears in `ArReceiptInput` / `stageArReceipt` / `postArReceipt` and also in
  `StockReceiptInput` / `stageStockReceipt` / `postStockReceipt`. An accounts-receivable
  receipt is, in accounting, **money coming in from a customer**; a stock receipt is **goods
  coming in from a supplier.** One word, two opposite-direction events.
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
| **Item** | the thing that is ordered, held, moved, sold, and assembled | `stock` (as a noun for the thing), and loose uses of `product` |
| **Product** | a level of the item tree, a group of related items, and only that | a synonym for item |
| **Location** | any real place stock is held, including a factory, a warehouse, and goods in transit | `warehouse`, `outlet`, `site` (these stay as location *types*, which are data) |
| **Supplier** *or* **Vendor** | who we buy from | see decision 2 |
| **Customer** | who we sell to | `client`, `buyer` |
| **Stock** | a quantity of an item held at a location ("stock level", "stock take") | the thing itself |

**Lifecycle verbs**, each with one meaning:

| Verb | Means |
|---|---|
| **order** | commit to buy or sell, before anything moves |
| **receive** | items arrive at a location from a supplier |
| **transfer** | items move between locations of the same business, at any distance |
| **dispatch** | items leave to a customer |
| **write off** | items are lost |
| **produce** | components are consumed and an assembled item is made |
| **count** | verb only: how many rows; the noun is a *stock count* |

**Retire or define**: `fetch` (rename, and stop shadowing the platform name); `save`, `update`
(fold into `set`, or define how they differ); `register` (fold into `create`, or define);
`restock` (a *reason* for a transfer, not a separate operation); and `receipt` (split into
*goods received* and *payment received*).

## The `transferItems` question

You asked to refer to `transferItems`. Under this draft that is the right name: **transfer**
is the lifecycle verb and **Items** is the noun. But `transferStock` has siblings, and
renaming one would create the very inconsistency this chapter measures:

| Today | Under the draft |
|---|---|
| `transferStock` | `transferItems` |
| `receiveStockAtLocation` | `receiveItems` |
| `dispatchStockFromLocation` | `dispatchItems` |
| `writeOffStock` | `writeOffItems` |
| `dispatchRestockFromPickingList` | a `transfer…` name, since it moves between own locations |
| `stageStockReceipt` / `postStockReceipt` | `…ItemReceipt` or `…GoodsReceipt` |

**One collision to settle first.** The file `db-stock.ts` would become `db-items.ts`, but
`routes/items.ts` and the item catalogue already own "items". The movement code is about
*holding and moving* items, not about the catalogue.

The rename would **likely** touch the backend, the frontend API wrappers, the Svelte pages, the
tests, the Step Runner registry and the manual (no count has been taken), so it should be one
tool-assisted, verified step with the full test suite as proof, not a series of edits. It has
not been started.

## Decisions needed

1. **`transferItems` and its family.** Rename the whole family together (table above), or only
   `transferStock`? Renaming one alone creates the inconsistency this chapter measures.
2. **Supplier or vendor?** You say *supplier*; the code says *vendor* (4 names plus `source`
   in `item_source`). Renaming `VendorName`, `asVendorName` and the rest touches many files.
3. **Does `product` keep its structural meaning** as a level of the item tree, with the types
   corrected to match (a `ProductName` distinct from `ItemName`)? Or is the product level
   itself something to retire?
4. **`receipt`:** split into goods received and payment received?
5. **`dispatch`:** reserved for customers, with movements between own locations called
   `transfer`?
6. **Which of the verb synonyms are real distinctions** (`save`/`update`/`set`,
   `register`/`create`, `fetch`/`get`)?
7. **Should a naming check be a gate,** like `check-unused`, failing when a retired word
   reappears in a new name? It needs the vocabulary agreed first.

## Not verified

Whether `save`, `update` and `register` differ in behaviour from `set` and `create`; the exact
meaning of `dimension` versus `hierarchy`; the frontend Svelte files and route paths (the
analysis reads `.ts` exports only); and how many places a family rename would touch (a
count has not been taken).
