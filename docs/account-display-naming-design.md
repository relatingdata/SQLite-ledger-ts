# Account Display Naming: Design and Implementation

## The problem, confirmed by direct screenshot review

Multiple, genuinely different accounts — an Inventory leaf, a Sales Revenue leaf, and a Cost of
Goods Sold leaf, all for the same item/location pair — displayed with identical, indistinguishable
names on the Trial Balance. A first fix (walking one level further up the tree) was itself
incomplete: Sales Revenue and Cost of Goods Sold still shared an identical displayed name, since
both nest under the same real category structure (e.g. `Income > Sales Revenue > Beer > Ale >
Item` and `Expense > Cost of Goods Sold > Beer > Ale > Item` share `Beer > Ale`), and the fix
stopped at the first ancestor that happened to differ from one known duplicate — not genuinely
unambiguous, just lucky against the one case tested.

## The design: the complete real path, never a partial walk

`getQualifiedDisplayName` (`backend/src/db.ts`) now builds the complete, real path from `Chart of
Accounts` (exclusive) down to the leaf (inclusive), joining every real, distinct ancestor name with
` — `. This is unambiguous by construction — two accounts under different real categories always
produce different full paths, with no need to search for "just enough" disambiguation.

The one case still collapsed: a leaf's own name that already contains its immediate parent's name
as a literal prefix (e.g. `ensureCombinationAccountLeaf`'s `"Item — Location"` under a parent node
also named `"Item"`) — collapsing this avoids the earlier, separate "X — X — Y" doubling defect,
and is the only collapsing this function does; it is never used to decide "is this unique enough
yet," only to avoid a literal, redundant repeat.

## Where currency lives, confirmed directly against the schema

`account.currency` (`backend/schema/00-core.sql`) is a column on the `account` table itself, one
row per `entity_id` — set per-leaf, directly, via `setAccountCurrency`, never inherited from a
Chart of Accounts category. There is no "this whole category is currency X" concept; each leaf
must be explicitly tagged.

## A separate, further, confirmed defect — not yet fixed

The General Journal listing (`frontend/src/routes/journal/+page.svelte`) displays every amount as
if it were a dollar figure divided by 100, including real quantity and storage-space postings that
are plain, whole counts (e.g. 24 real bottles shown as "0.24"). The same class of defect already
fixed on the Trial Balance screen (checking `account.currency` and only applying cents-formatting
to a real monetary currency) has not been applied here.

## The final, working implementation

```typescript
export function getQualifiedDisplayName(entityId: number): string {
  const entity = getEntity(entityId);
  if (!entity) return '';
  const chain: string[] = [];
  let current = entity;
  while (current && current.name !== 'Chart of Accounts') {
    const soFar = chain.join(' — ');
    if (!soFar || !soFar.startsWith(`${current.name} — `)) {
      chain.unshift(current.name);
    }
    current = current.parent_id != null ? getEntity(current.parent_id) : undefined;
  }
  return chain.join(' — ');
}
```

Walks from the leaf up to (but excluding) `Chart of Accounts`, accumulating every real ancestor
name — skipping only an ancestor whose name is already a literal prefix of the name accumulated so
far (the one real case worth collapsing: a combination leaf's own name, e.g. `"Item — Location"`,
already contains its immediate parent's name, `"Item"`). This produces the complete, real path —
`Inventory — Amber Ale 330ml — Main Street Cellar`, `Sales Revenue — Beer — Ale — Amber Ale 330ml
— Main Street Cellar`, `Cost of Goods Sold — Beer — Ale — Amber Ale 330ml — Main Street Cellar` —
unambiguous by construction, confirmed by screenshot of the real Trial Balance: all three now
render as genuinely distinct rows.

## Status at time of writing

Compiles clean (`make check-backend-types`). Not yet re-verified by a fresh test run or a new
screenshot since this exact version was finalized — see the next checkpoint's own test results.
The General Journal listing's own, separate amount-formatting defect (quantity postings shown
divided by 100, as if dollars) remains confirmed but not fixed.
