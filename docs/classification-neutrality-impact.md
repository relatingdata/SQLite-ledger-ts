# Classification Neutrality: Impact Analysis and Findings

**Principle (stated directly):** hot/cold, storage, division and category are
merely *suggested* classification hierarchies. Locations and Items are the real
things. A wine shop might classify by hot/cold; a hardware store by
inside/outside. No code should give any one of these special treatment.

**Method:** `make analyze-classification` writes
`docs/classification-neutrality-analysis.md` (generated — never hand-edited). It
splits identifiers into words, so `isColdStorageProduct` and `COLD_SUFFIX` both
count as "cold", and separates identifier, string-literal and comment hits.
This chapter is the interpretation; the numbers below come from that report.

Production hits (identifier / string / comment; backend source, frontend and
structural schema): cold 48/22/27 in 8 files; hot 0/19/10; refrigerated 1/17/2;
storage 106/41/55 in 17 files; **division 351/123/232 in 30 files**; category
171/53/157 in 26 files. Tests and tooling add a further 149/182/37 (division)
and 116/123/30 (category), which would also need updating.

## Read this before trusting any number

- **Name-based detection misses the sneakiest cases.** `resolveDispatchLocation`
  did not appear as a "cold" definition because its *name* contains no
  classification word. Its special treatment is in its body. It was found only
  through the string-literal listing.
- **Two of the words are contaminated.** `storage` includes Node's
  `AsyncLocalStorage` (`session-context.ts`, referenced from 26 files), the
  `*_STORAGE_KEY` browser constants and `window.storage`, none of which are
  classification. `category` conflates two different things (see Tier 4).
- **Blast-radius figures for generic names are noise.** A local variable named
  `division` in five unrelated files reports 656 references. Only distinctive
  names (`getProfitAndLossByDivision`, `cityDivisionFor`) are meaningful.
- **The translations column reads 0 for every term.** Checked: the five
  `10-vocab-*.sql` files are 4KB each and essentially empty. The translated
  labels ("Per Division", "Profit and Loss per Division for:") live in
  `00-core.sql`, where they are counted.
- **Not measured:** SQL triggers or views whose behaviour is keyed on a
  literal, and behaviour that depends on a classification without naming it.

## Tier 1 — hot/cold built in as first-class (clear violations, small blast radius)

The same business assumption (shelf versus refrigerated) is modelled three
times, in parallel to the Hierarchies mechanism, which can already express it as
a user-defined grouping.

1. **Item "Storage Origin".** `setItemStorageOrigin` / `getItemStorageOrigin`
   (`backend/src/db.ts:844`, `:857`) put exactly two values into the *type
   signature* (`'Hot' | 'Cold' | null`), plus a fixed dimension name
   (`'Storage Origin'`), a fixed parent (`'Storage Origin Types'`) and a
   dedicated marker type. Around it: the API route `/items/:name/storage-origin`
   (`routes/items.ts:116`, `api.ts:851`); UI on Cash Sale/Purchase
   (`CashTransaction.svelte`), AR Sale and AP Purchase through `storageOriginOf`,
   with CSS classes `storage-tag cold` / `storage-tag shelf`; and the e2e test
   `storage-origin-display.spec.ts`. A hardware store's inside/outside cannot be
   expressed.
2. **`resolveDispatchLocation`** (`db.ts:3282`). Routes a dispatch to a
   sub-location when the item's origin is the literal `'Cold'`, found by
   `WHERE cold.name LIKE '%Refrigerated%'` — matching on an entity **name
   pattern**. Renaming a location silently breaks it. This is the most fragile
   of the three.
3. **"Create Refrigerated Section"** on the Locations page
   (`locations/+page.svelte`, 41 cold hits). `COLD_SUFFIX = ' — Refrigerated'`,
   `coldLocation`, `coldBottleCapacity`, `createColdSection`, `saveCold`, and the
   button labels. It creates a sub-location by naming convention, linked with
   `relation_id`.

## Tier 2 — my own work this session: named "Storage", mechanically generic

`convertStorageSpace`, `openStorageContainer`, `ensureStorageCapacityStructure`,
the routes `/convert-storage` and `/open-container`, and the labels "Storage
Actions", "Receive Into Storage" and "Storage grouping (optional)". Their
mechanics already take arbitrary groupings and values, so neutralising them is
**renaming, not redesign**. The exception is the built-in `Storage Capacity` /
`Remaining` / `Installed` / `Occupied` structure and the `SPACE-` and `UNITS-`
currency prefixes, which depend on the boundary decision below.

## Tier 3 — Division: pervasive, and the highest-value target

30 production files; the heaviest are `db-reports.ts` (73), `db.ts` (68),
`setup/business-setup/+page.svelte` (50) and `00-core.sql` (31). It is a
concept, not a word:

- a branded type (`DivisionName`, `asDivisionName`), a `division` extension
  table, a "Division Type" (`setDivisionType`) and a "Belongs To Division"
  relationship;
- **`cityDivisionFor`** (`db.ts:3258`), which auto-tags a sale or stock movement
  with a division, by relationship or by matching the location's city;
- P&L by division (`getProfitAndLossByDivision`, `…Tree`,
  `getLedgerBalancesByDivisionStructural`), and year-end close posting retained
  earnings per division;
- a `/divisions` router and the components `DivisionTreePicker` and
  `DivisionPLNode`;
- the literal strings `'Division'` (23 uses) and `'Category'` (22 uses), first
  seen at `db-matrix-reports.ts:33`. **Inferred, not read:** these look like the
  hardcoded axis names of the matrix reports. If so, that is exactly what "any
  hierarchy the business defines" should replace.

## Tier 4 — Category: two different things under one word

- **(a) Item category — structural.** Per `docs/entity-model.md`, items sit in a
  physical `Category → Product → Item` tree under the Items root
  (`typeCategoryOrItemsRootName`, `ensureCategoryChain`, `createItemCategory`,
  the Items page's new-category form, `shared-fixtures/categories.csv`).
  Neutralising this means items live directly under Items and category becomes
  one hierarchy among many. That is a **data-model change** to entity parentage,
  touching every item lookup.
- **(b) Accounting category** (Asset / Liability / Equity / Income / Expense;
  `SELECT category FROM business_reports WHERE account = ?`, `db-journal.ts:59`,
  and `fetchGlobalCoaCategory`). This appears to be accounting structure, not a
  suggested classification, and should **not** be touched. That it is accounting
  is inferred from one query, not verified.

## Decisions needed

1. **The manual contradicts the principle.** `docs/entity-model.md` records
   Storage Origin (Hot/Cold) as a deliberate design made "per direct
   instruction" — the first cartesian dimension made explicit, replacing an
   earlier hardcoded guess. The principle now says it should be neither.
   Confirm the earlier decision is superseded.
2. **The Storage Capacity boundary.** Earlier you defined `Storage Capacity →
   Remaining / Installed` as built in. Is that capacity accounting the built-in
   part, with Hot/Cold/Secure/Inside/Outside merely suggested classification?
3. **Is an item's placement under its category structural by design?** (Tier 4a.)
4. **Division's accounting behaviours** — auto-tagging (`cityDivisionFor`) and
   per-division year-end close: keep them as behaviour "dimensioned by any
   chosen hierarchy", or drop them?

## Suggested order (cheapest and clearest first) — none started

1. **Tier 2 rename** (~8 files, mechanical) — after decision 2.
2. **Tier 1** (~8 production files, one e2e test): replace with a
   hierarchy-driven mechanism. The open design question is how a dispatch picks
   a location by classification value without matching on a name.
3. **Tier 3** (30 files): generalise the report axes and the per-division
   behaviours to any chosen hierarchy.
4. **Tier 4a** last: the data-model change, the largest and riskiest.

## Stale documentation found along the way

- `docs/cold-shelf-storage-inventory-model-plan.md` and
  `docs/function-inventory.md` still describe `isColdStorageProduct` and
  `COLD_STORAGE_CATEGORIES`, which were removed (see `docs/entity-model.md`).
