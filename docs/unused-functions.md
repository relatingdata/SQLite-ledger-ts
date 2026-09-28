# Unused Functions: commented out, not deleted

At checkpoint 426, **31 functions with no references anywhere** were commented out. This
chapter records which, the evidence that each is unused, and how to restore or remove them.

## How they were commented out

`make comment-out-functions FILE=<path.ts> NAMES=a,b,c` (`DRY=1` previews). Each function gets a
one-line marker above it that points here, and every line of the function is prefixed with `// `.

There is **no standard tool for this**: knip's `--fix` only removes the `export` keyword, and
nothing standard comments out or deletes a whole unused function. That is the only reason a
small bespoke tool exists for it. It is a one-shot migration aid, not part of any gate.

## An honest tension with our own rule

`docs/coding-standards.md` says code carries a pointer to the manual and no prose. Commented-out
code is not prose, but it is dead text in the source, which the rule exists to avoid. Two
things make this acceptable **for now**: the marker points here, and the state is temporary.
Git already preserves every deleted function in every checkpoint, so *deleting* would lose
nothing. Commenting out was asked for as the safer first step, because it lets the type-checker
and every test prove the functions were unused before they are gone for good.
`make strip-comments` removes whole-line comments, so migrating one of these files later will
delete the commented-out functions along with the rest.

## What was commented out

**Backend (7)**, confirmed unused by two independent methods: the compiler-generated function
inventory, and knip, which listed all seven too.

| File | Functions |
|---|---|
| `backend/src/db.ts` | `getLineType`, `removeContactType`, `getContactsWithType`, `getItemProduct`, `getScreenTitle`, `getAllTranslations` |
| `backend/src/session-context.ts` | `setCurrentBusiness` |

**Frontend library (24).** Knip could not be run on the frontend (see `docs/coding-standards.md`,
"Standard tools first"), so the evidence here is the function inventory plus `svelte-check`,
which types every Svelte file and would fail on any real use.

| File | Functions |
|---|---|
| `frontend/src/lib/api.ts` | `asDivisionName`, `getBusinessReports`, `getChartOfAccounts`, `setMenuOverride`, `deleteMenuOverride`, `getProfitAndLossByDivision`, `getVocabularyAlternates`, `getNominatedBankAccounts`, `getStagedLines`, `removeStagedLine`, `stageARSale`, `postARSale`, `stageAPPurchase`, `postAPPurchase`, `getItemStorageOrigin`, `setItemStorageOrigin`, `listProducts`, `createProduct`, `setItemProduct`, `getScheduleAtLocation`, `dispatchItems`, `setItemSourceLeadTime`, `getStockListing` |
| `frontend/src/lib/auth.ts` | `hasRole` |

Most of the frontend ones are wrappers for backend routes whose screens do not call them yet.
Their backend counterparts (`stageARSale`, `postARSale` and so on) are **not** commented out,
because the backend routes use them.

## What was deliberately not touched

Object and store methods that the inventory also reports as having no callers:
`Entity.rename`, `Entity.reparent`, `Entity.children`, `Link.mark`, `Link.unmark`,
`Link.isMarked`, `Detail.delete`, `typeCategoryOrItemsRootName.validate`, and the frontend
store methods (`auth.set`, `session.clear` and similar). These are part of the core primitives'
and stores' API, not stray functions, so removing them is a design decision.

The 35 further exports that knip reports (exported but imported by nothing else) are also
untouched. Many are used inside their own file, and commenting them out would break it. They need
`export` removed, not the function.

## Verified after commenting out

| Check | Result |
|---|---|
| Backend type errors | no new real ones. The count went 6 to 7, and the extra was an import (`Link`) left unused, now removed. |
| Unused-declaration gate | passes |
| Frontend `svelte-check`, every Svelte file | 0 errors |
| Unit suites | 229/229 backend, 24/24 frontend |
| Tutorial via the API | 10/10 |
| Simulation output | identical to the recorded baseline, all 21 result lines |

**Not run:** the Playwright end-to-end specs and the tutorial through the browser, which do not
run reliably in the environment this was done in.

## Restoring one

Delete the marker line and the leading `// ` from its lines, or restore it from the previous
checkpoint. Removing them permanently is the same edit in reverse: delete the commented block.
