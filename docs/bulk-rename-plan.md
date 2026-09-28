# Bulk Renaming: what order, and how to know it is safe

**Status: a plan. No rename has been done.** It answers three questions: which renames can happen
and in what order; whether the tutorial end-to-end test, run through the backend API, is enough
to be confident a rename is safe; and the same for the frontend. The vocabulary being applied is
in `docs/naming-vocabulary.md`.

## Is passing the tutorial through the API enough? No

It is necessary and it is fast, but it reaches very little. `make test-e2e-tutorial` walks ten
steps (login, select and create a business, switch session, create a location, create three
items, receive into storage, open a container) by calling backend functions directly. Whether
the test scripts must be renamed too: **yes**, they call these functions by name, and the
Step Runner's `API_REGISTRY` and `screens.csv` hold function names as strings, so both are part
of any rename and are found by `make find-uses`.

How much of what would be renamed the end-to-end runs *directly* reference (from
`make explain-function`, which resolves references with the TypeScript compiler):

| Function | Tutorial | Simulation | Unit tests | Routes |
|---|---|---|---|---|
| `receiveStockAtLocation` | 1 | 3 | 57 | 1 |
| `dispatchStockFromLocation` | 0 | 0 | 8 | 1 |
| `transferStock` | 0 | 0 | 7 | 1 |
| `writeOffStock` | 0 | 1 | 4 | 1 |
| `stageStockReceipt` / `postStockReceipt` | 0 / 0 | 0 / 0 | 2 / 3 | 1 / 1 |
| `stageArSale` / `postArSale` | 0 / 0 | 0 / 0 | 3 / 4 | 1 / 1 |
| `stageApPurchase` / `postApPurchase` | 0 / 0 | 0 / 0 | 2 / 2 | 1 / 1 |
| `ensureProductInventoryAccount` | 0 | 1 | 1 | 0 |
| `ensureProductQuantityAccounts` | 0 | 0 | 0 | 0 |
| `ensureProductSalesCogsAccounts` | 0 | 1 | 6 | 0 |
| `getProductUnitCostMinor` | 0 | 0 | 0 | 0 |

So the tutorial reaches one of these fourteen directly. **The unit tests are the main guard for
most renames**, not the end-to-end runs. Two cautions on reading the table: a `0` means no
*direct* reference, and a function can still run indirectly (a sale calls several of these
internally), so this is a lower bound. Only a runtime coverage tool such as `c8` could give the
true figure; that has not been run. And `proof-year-end-lifecycle.ts` calls `transferStock`
but is **not part of any gate** and was not run.

## What "green" is today

Measured at checkpoint 426, before any rename:

| Check | State |
|---|---|
| Unit suites (`make test`) | 229 backend and 24 frontend, all pass |
| Tutorial via the API (`make test-e2e-tutorial`) | 10 of 10 |
| Frontend type-check (`make check-frontend`, `svelte-check` on every `.svelte` file) | 0 errors |
| Backend type-check (`make check-backend-types`) | 6 known errors, none new |
| **Simulation (`make test-e2e`)** | **red: 20 checks fail, and the output is stable** |
| Tutorial through the browser | not run: known to time out at the screenshot in step 6 in this environment |
| Playwright specs | not run |

**The simulation is already failing, and has been since before this work.** It fails
identically at checkpoint 408, the last checkpoint before this conversation: the same 20
checks, with the same expected and actual numbers, byte for byte. So none of checkpoints 409 to
425 changed what it computes. But the failure itself is unexplained and looks serious: income
is 11,109,425 against an expected 19,547,533 (43% below), the vendor balance is -14,118,120
against -36,715,404, the cash figure is off, and 20 product categories are sold against an
expected 14. Either the simulation was changed deliberately and its expected numbers were never
updated, or something regressed. **The expected numbers must not be updated to match until that
is understood.** Finding when it broke needs a bisect (each run takes about two minutes).

**Meanwhile it works as a regression signal.** Its output is deterministic, so
`make check-sim-unchanged` requires the PASS and FAIL lines, with their numbers, to stay
*identical* to the recorded `backend/test/golden/simulation-results.txt` (recorded by
`make sim-golden`). That does not say the numbers are right; it says a rename did not change
them.

## The order

Principles: remove dead code first, so nothing is renamed that is about to go; smallest blast
radius first; decided before undecided; renames whose new names may change again last; the
largest last; and every step is one commit, verified, with the manual updated in the same step.

| # | Step | Names | Lines | Files | Ready? |
|---|---|---|---|---|---|
| 0 | Comment out unused functions | 31 | | | **done**, see `docs/unused-functions.md` |
| 1 | `Ar`, `Ap`, `ar` to `AR`, `AP` in names | 28 | 241 | 21 | decided (the count will fall, since several AR/AP wrappers are now commented out) |
| 2 | the eight item-sense `ensureProduct…` names to `ensureItem…` | 8 | 167 | 28 | decided |
| 3 | the settled part of the movement family: `receiveItems`, `dispatchItems`, `transferItems`, `writeOffItems`, and `StockReceipt` to `OrderReceipt` | 14 | 443 | 46 | decided in principle. Hold `dispatchRestock…` and the restock picking list until the TransferOrder is designed, and settle the file name first |
| 4 | `fetch` to `requireEntity` (and `fetchById`, `fetchGlobalCoaCategory`) | 3 | 494 | 52 | **needs a yes** |
| 5 | Vendor to Provider | 35 | 1,074 | 111 | **needs a yes**, and the fate of `item_source` |
| 6 | Not renames: the Product level of the item tree, `/goods-services` to a Services catalogue, Division and Category neutrality, the Storage-named functions | | | | **need design** |

Step 3 must come before step 5, because both touch `db-stock.ts`. Step 4 is the largest by
lines but is mostly tests. Step 5 is the largest by files and should be last of the mechanical
ones.

**Rename identifiers only, never strings.** A blanket text replace would change URL paths,
route directories, database names and, for Vendor to Provider, the **translatable UI labels**
"Supplier" and "Vendor", which are Vocabulary and must not change. Use a semantic rename for
`.ts` files (the TypeScript language service, for example through `ts-morph`), and a
word-boundary replace for the rest driven by the `make find-uses` list, reviewed as a
`git diff`. Such a tool has not been built or chosen.

## How a rename is applied

`make rename-identifiers MAP=renames/<file>.txt` (add `DRY=1` to preview). The map has one
`old new` pair per line, and each step of the order below has its own file in `renames/`, so the
exact set of names changed by a step is on record.

It replaces whole words over the tracked text files (`.ts`, `.svelte`, `.csv`, `.json`, `.md`,
`.mjs`). Safeguards, each there because of a specific way a bulk rename goes wrong:

- **It refuses if a new name already appears anywhere**, since that would silently merge two
  different things into one.
- **It reports any old name it cannot find**, so a typo in the map is visible rather than a
  silent no-op.
- **It skips the documents that discuss the renames** (`naming-vocabulary.md`, this chapter,
  `item-terminology-and-storage-design-notes.md`, the release notes and the lessons learned) and
  all generated files. Otherwise a table saying "`transferStock` becomes `transferItems`" would be
  rewritten to say "`transferItems` becomes `transferItems`".
- **It preview-then-applies**: run with `DRY=1` first.

Whole-word replacement is right for a *distinctive* identifier such as `stageArSale`. It is
**wrong** for a word that also appears as a string or in prose, which is why `fetch` and Vendor
need a different approach (steps 4 and 5). The renaming tool is deliberately simple; the
type-checker, the tests and `svelte-check` are what prove a rename, not the tool.

## How to check a rename, in this order

1. `make check-backend-types`: no new errors beyond the six known. This catches a missed
   reference in `src/`.
2. `make check-unused`.
3. `make check-frontend`: `svelte-check` types every `.svelte` file and `api.ts`, so a missed
   import of a renamed wrapper fails here. This is a strong guard for names.
4. `make test`: 229 and 24 tests. This is the main guard for behaviour.
5. `make test-e2e-tutorial`.
6. `make check-sim-unchanged`.
7. `make function-inventory` then `make check-function-inventory`, and `make verify-fresh`.

**A gap in step 1:** `make check-backend-types` type-checks only `src/`. The tests, the Step
Runner and the other scripts are **not type-checked**, and about 295 type errors are hidden
there (`docs/programmer-tooling.md`). A missed reference in a test or script fails only when it
runs, and `proof-year-end-lifecycle.ts` never runs in any gate. Type-checking all of it would be
the single strongest addition, but it means clearing those errors first, or deleting the dead
prototype scripts that account for most of them.

## The frontend

The frontend API wrappers in `api.ts` mirror the backend function names (`transferStock`
exists in both, with separate implementations), so a backend rename implies renaming the wrapper
and its Svelte callers if the vocabulary is to be consistent.

**What guards it:** `svelte-check` (step 3 above) and the 24 frontend unit tests. **What does
not:** behaviour. The Playwright specs and the tutorial through the browser are the tests that
would show a page working, and neither could be run in the environment this plan was made in.
They should be run on a normal machine, before and after each step, with
`make test-e2e-tutorial-playwright`. Until that is done, frontend confidence for a rename is
"it type-checks and the unit tests pass", not "the pages work".

## Not verified

The true runtime coverage of the tutorial and the simulation (only a static lower bound was
taken); the Playwright specs; the tutorial through the browser; `make proof-year-end`; when and
why the simulation broke; and whether the counts above will hold after step 0 removed some
callers.
