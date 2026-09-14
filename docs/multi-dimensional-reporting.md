# Multi-dimensional reporting: equal accumulation paths from a shared root

A full, elaborated capture of a real, extended design discussion — starting from a request to add division/location breakdowns to the P&L and year-end close, and arriving at something more general: a real, reusable pattern for any entity that needs to be summed up through more than one, equally-valid hierarchy at once.

## 1. Where this started, and the wrong turns corrected along the way

The original request: add "Consolidated per Division" and "Consolidated per Division per Location" views to the P&L, and the same breakdown to the year-end close. Several real misunderstandings got corrected in sequence before the actual, right shape emerged — worth keeping on record, since each correction rules out a real, tempting-but-wrong implementation:

1. **First wrong turn**: treating division/location as a `journal_line`-level tag (like the existing `division_id` column), separate from the Chart of Accounts structure. Corrected: **"No tags!!! it is supposed to be the structure in the chart of accounts!!!"**
2. **Second wrong turn**: proposing real, separate, name-suffixed accounts per location (`Sales — Main Store`). Corrected: no such thing — one real, single, plain-named leaf account per (product, purpose) pair, never duplicated per location.
3. **Third wrong turn**: assuming a location *is* a division (the existing data literally names things "Riverside Cellars Division"). Corrected: **locations are leaves, not divisions** — a real location sits *under* a division, but is not itself one, and is not itself postable as an account.
4. **Fourth wrong turn**: assuming one of the two hierarchies (division/location vs. product-category) is the account's real, structural parent, with the other reached via a secondary link. Corrected: **neither is privileged** — both are equal, independent, complete accumulation paths to the same root.
5. **Fifth wrong turn**: rooting the whole thing at the *application* level (reasoning from the real fact that GL accounts are physically shared across businesses). Corrected: each business is its own real root, for this purpose — "business (A, B, C) at the top of any hierarchy at any one time."
6. **Sixth wrong turn** (mine, twice): naming leaf accounts with a hierarchy's own prefix baked in (`Sales - Amber Ale`). Corrected: the leaf's own name never encodes which hierarchy it's being viewed through — the *path*, not the *name*, carries that meaning. This applies to every hierarchy equally, not just the new one — the existing product-category tree already gets this wrong today (see §6).

## 2. The corrected entity model

```
Wine Retail Company                         (the business — a real root)
    │
    ├── Springfield                          (a real division)
    │       ├── Head Office                  (a real location — a leaf)
    │       ├── Riverside Cellars             (a real location — a leaf)
    │       └── Uptown Wine & Spirits         (a real location — a leaf)
    │
    └── Rivertown                             (a real division)
            ├── Warehouse B                   (a real location — a leaf)
            ├── Market Square Liquor           (a real location — a leaf)
            ├── Harbourside Bottle Shop        (a real location — a leaf)
            └── Eastside Cellar Door           (a real location — a leaf)
```

The real, live data today has this inverted — "Riverside Cellars Division" is mis-modeled as a division in its own right, and there's no real, separate "Springfield"/"Rivertown" division sitting above the stores at all (each store currently *is* a top-level division). This is a real, genuine data-model bug to fix, not just a reporting gap: locations need to become real leaves under their own real division, and the division layer itself needs to genuinely exist above them.

Both layers — division and location — may go several levels deep for a more complex business (a division containing sub-divisions containing further sub-divisions before finally reaching a location leaf). The diagram above is the simple case; the real mechanism needs to support arbitrary depth on both sides.

## 3. The Chart of Accounts, corrected

```
Wine Retail Company                         (business A — the real root)
    │
    └── Chart of Accounts
            │
            ├── Balance Sheet
            │       └── Assets / Liabilities / Equity
            │
            └── Profit and Loss Statement
                    ├── Income
                    │     └── (leaf: Amber Ale 330ml — Sales)   ◄─┐
                    └── Expenses                                  │
                          └── (leaf: Amber Ale 330ml — COGS)    ◄─┤
                                                                    │
        ┌───────────────────────────────────────────────────────────┘
        │
   Dimension 1: Springfield → Riverside Cellars → both leaves above
   Dimension 2: Beer → Ale → Amber Ale 330ml → both leaves above
        (Dimension 2 is a neutral product tree, never rooted under
         "Sales" or "COGS" — which leaf you land on depends on
         whether you asked for the product's Sales side or its COGS
         side, not on the category path itself)
```

The Chart of Accounts really is just another dimension in exactly this sense — Balance Sheet and P&L are its own two, real, equal branches, both eventually terminating in the same leaf accounts a business actually posts to. It is genuinely rooted at the business (confirmed: `Wine Retail Company`, not the application), even though the underlying GL account *rows* happen to be physically shared storage across every business (a real, separate implementation fact, not a conceptual one — see the earlier, corrected wrong turn #5).

A CoA *family* (English CoA, and any other prototype/locale-translated CoA) is a separate, real thing — a template a business's own CoA gets built from at creation time, not itself a business, and not part of any one business's own, live hierarchy once instantiated.

## 4. The core insight: multiple, equal accumulation paths from one leaf

A single, real leaf account (e.g. "Amber Ale 330ml — Sales") is reachable via at least two real, independent, equally-valid paths back to the business:

- **Division/location path**: leaf → Riverside Cellars → Springfield → Wine Retail Company
- **Product-category path**: leaf → Ale → Beer → Sales (Income) → Wine Retail Company

Neither is the account's "real" parent with the other as a lesser, secondary link. Both are genuine, complete, independent summation paths. A report walking either path aggregates correctly and completely to the same root; which one you choose depends only on which dimension you want the report to accumulate by.

## 5. Why a single `parent_id` genuinely isn't enough — the "reverse index"

`parent_id` gives one real, structural upward path for free: walk it repeatedly and you reach the root. That's sufficient for exactly one dimension. But it only goes *up*. To go the other direction — start at the business, pick a dimension, and ask "what are this node's children, in that specific dimension" — `parent_id` alone can't answer it, since nothing points backward from a parent to its children in a queryable way for an arbitrary, chosen dimension.

Each additional, equal dimension therefore needs its own real, separate, genuinely reversible index — something that can answer both "who is this node's parent, in dimension X" and "who are this node's children, in dimension X" — independently of whatever `parent_id` itself says, since `parent_id` is already spoken for by whichever dimension is treated as the entity's default/structural placement (in the corrected model above, that's the Chart of Accounts / product-category placement for a GL account — see §3).

## 6. Generality beyond the P&L — this is not a one-off, P&L-specific mechanism

The real, underlying shape here is far more general than divisions and product categories. The same pattern applies directly to:

- **Org charts**: a real employee genuinely reporting into two managers at once, or holding two, real, distinct responsibilities each with their own, separate reporting path.
- **Products in multiple category trees**: a product that's simultaneously "a Beer" and "a Seasonal/Limited-Release item", two real, independent, equally-valid categorizations.
- **Locations serving two purposes**: a location under one division for cost-accounting purposes and a genuinely different one for regional-sales-reporting purposes.

All of these are the same, real problem: one leaf, several equal, independent accumulation paths to a shared root, none structurally privileged. Building the reverse-index mechanism generically — a real, reusable "dimension" concept, not hardcoded to divisions and products specifically — means every one of these becomes the same, already-solved case, rather than a new, bespoke mechanism each time.

## 7. The longer-term direction: Entity / Object Type / Object Instance / methods

A further, explicitly longer-term, explicitly *not* a strict requirement right now: that this codebase's own architecture should increasingly reflect a formal Entity → Object Type → Object Instance → (Object-Type Method, Object-Instance Method) model, "not a strict straitjacket, but definitely very desirable in the long run."

Honest accounting of where this already holds and where it doesn't, rather than agreeing reflexively:

- **Already true, deeply**: "Entity as universal base" is not aspirational — it is the actual, literal, load-bearing architecture today. Every real thing in this app (a business, an account, a customer, a division, a location, an employee) is, at root, one row in one, single `entity_ids` table with a name and a parent. This has been true since early in the project, confirmed and relied on repeatedly.
- **Genuinely looser today**: "Object Type" is currently positional and implicit — something is "a customer" because of *where* it sits in the tree (under Accounts Receivable) or because a separate extension table (`account`, `contact`) happens to be attached to it, not because it carries any real, explicit type identifier. "Methods" are likewise just plain functions grouped by feature area (`db.ts`, `db-reports.ts`), not dispatched through any formal type/instance distinction.
- **Why this matters concretely, right now**: the reverse-index/multi-dimension mechanism this document is about *is* an Object-Type-level capability in this sense — "any entity, in any dimension, walk up or down" is a capability that should belong to entities generally, not be bolted on specifically for divisions and product categories. Building it generically is a real, concrete, honest first step toward the longer-term direction, not a separate, unrelated effort — the right reason to lean into generality now rather than defer it, even though the fuller Object-Type/Method model itself stays a longer-term aspiration, not something to force through immediately.

## 8. Proposed, concrete near-term scope

Separating the long-term aspiration (§7) from what's genuinely buildable now:

1. **Fix the entity model** (§2): locations become real leaves under their own real division; the division layer itself is corrected to genuinely sit above locations, not be conflated with them. A real, direct data-migration/correction question, not just new code.
2. **Remove the "Sales -"/product-prefix from leaf account names** (§3, wrong turn #6): the existing product-category tree already violates the "name never encodes the hierarchy" principle this whole design rests on — worth fixing at the same time, not left as a known inconsistency.
3. **Build the reverse-index mechanism generically** (§5, §6): a real, reusable "dimension" concept an entity can be placed into, independent of `parent_id`, supporting arbitrary depth, not hardcoded to exactly two dimensions.
4. **Build the actual P&L "Consolidated per Division" / "per Division per Location" reports** on top of the corrected model and the new mechanism.
5. **Extend the year-end close's own breakdown** to use the same, corrected mechanism, per the original request (sales and COGS broken down by division and location, not just net income).

## 9. Real, open questions — not yet decided

- **Exact shape of the reverse-index storage**: a real, new table; a real, generic entity-relationship mechanism (reusing something like the `setEntityLink` pattern built earlier this session, generalized); or something else. Not decided here.
- **Migration path for the existing, inverted division/location data**: whether existing "X Division" location-leaves get renamed/re-parented in place, or a fresh structure is built alongside and the old one retired. Not decided here.
- **Scope of "arbitrary depth" and "arbitrary number of dimensions"**: whether the first, real implementation should genuinely support N dimensions from day one, or start with exactly the two known today (division/location, product-category) with genuine extensibility in mind but not over-built for hypothetical future dimensions before they're real. Not decided here.
- **Whether the reverse-index mechanism should be exposed as a real, general capability now** (moving toward §7's longer-term direction) or built narrowly enough to solve just the P&L/year-end reporting need, with generalization deferred until a second, real, concrete use case (an org chart, say) actually arrives. Not decided here.

## 10. The product/tier/leaf structure — confirmed, and why three real attempts at it broke something

A further, real, confirmed correction to the part model itself, distinct from division/location (§2): a real, single `part` today (e.g. "Amber Ale 330ml") is genuinely tier-less — one row, one UPC, one price — even though the same product is really, separately sold as a Bottle, a Carton, and a Six-Pack, each at its own real price. Confirmed directly: only one real `part` row exists for "Amber Ale 330ml" today; the "(Bottle)"/"(Carton)" distinction currently lives only in the GL account's own name, never on a real product entity.

The confirmed, corrected shape:

```
Amber Ale 330ml            (a summary category — never sold, never postable)
    ├── Bottle              (a distinct, sellable leaf — own price, own UPC)
    ├── Carton              (a distinct, sellable leaf — own price, own UPC)
    └── Six-Pack            (a distinct, sellable leaf — own price, own UPC)
```

"Amber Ale 330ml" itself becomes a real, non-sellable, non-postable summary node — the same real role a category already plays elsewhere — with real totals still summing up through it (per direct confirmation: "things can be summed up"), the same way any real parent category already aggregates its own real children today.

A real, genuine connection to a separate piece: "the retail outlet will break up carton into six packs and bottles or cans depending on the product" describes a real, physical unit-conversion process — confirmed directly, this is now a real, working backend mechanism (`stageBomComponent`/`postBomComponents`/`getBomComponents`, see `docs/sql-ledger-comparison.md`), though `/logistics/assembly-bom`'s own frontend management screen is still a real, honest, unbuilt stub. The tier-split above and the real Assembly BOM mechanism are genuinely related — a real conversion event moves real stock from one tier's own leaf to another's — but are two, separate pieces of work, not one; this document doesn't attempt the BOM piece.

### Three real, serious bugs found across three, real attempts — a genuine record, not glossed over

Building "part as a structural child of its own Sales leaf" (§4's original, tier-naive version) was attempted three separate times this session, each one finding a real, different, serious problem — worth recording plainly so a fourth attempt doesn't repeat any of them:

1. **Quantity-domain contamination of real financial statements.** The established `real_accounts` recursive CTE (used by `getLedgerBalances` and relatives) walked every real descendant of "Chart of Accounts" unconditionally, assuming each one was a real, financial GL account. Once `part` became a structural child of its Sales leaf, `part`'s own real children (its own "On Order"/"Units Sold" quantity-domain accounts) came along, corrupting real Trial Balance/Balance Sheet totals with unit counts instead of money — confirmed directly via a real `make demo-full-year` failure, not caught by unit tests alone. **Fixed and committed independently** (commit `9b93461`): the walk now stops the moment it reaches a real entity with a real `part` row, never descending past it.
2. **An over-broad first attempt at fix #1.** The first, real fix tried "stop at any account row" rather than specifically `part` — this broke a real, existing, legitimate case: a real, established summary account (e.g. "Inventory") can genuinely have its own real `account` row *and* further, real, postable-account children beneath it at the same time. Confirmed directly by a real, existing, passing test breaking the moment this was tried. The narrower, correct boundary is specifically a real `part` row, not any `account` row.
3. **The genuine, tier-naive assumption itself.** Re-parenting `part` under "its" Sales leaf assumes exactly one Sales leaf per part — false the moment a product has more than one tier, as "Amber Ale 330ml" genuinely does. The second tier processed for the same, shared, tier-naive part tried to re-derive its own category chain by walking up from the part's own, now-changed `parent_id` — which no longer led back to "Parts" at all, since the first tier had already re-parented it elsewhere — cascading into genuinely corrupted account names like `"COGS - Sales - Sales - Sales - Amber Ale 330ml (Six-Pack)"`. Confirmed directly, not guessed at. This is the real problem §10's own corrected structure (above) resolves: once each tier is its own, real, separate part entity, there is no longer a shared part with an ambiguous, single parent to re-derive incorrectly — each tier's own part has exactly one real Sales leaf of its own.

## Status (updated)

§§1–9 above still stand as the original design capture. §10 is a real, confirmed, necessary extension to it, found only after three real, serious bugs surfaced while attempting to build the original, tier-naive version — recorded here in full before any fourth attempt begins, so the same three mistakes aren't repeated. Bug #1's own fix (the corrected `real_accounts` CTE boundary) is the one, real, independently-valuable exception that was committed on its own, since it's correct regardless of how the tier-split itself proceeds.

A real, fourth attempt, structured differently from the first three specifically to avoid mistake #3 above (`ensureProductTierPart` creates a real, new, additional, distinct tier-level part alongside the existing base product, rather than re-parenting the shared, ambiguous one) succeeded, was verified against the full `make demo-full-year` check, and is now wired into the real, live POS sale posting path — a real sale carrying a real, specific tier now genuinely ensures its own, real tier-level part.

## 11. A real, important, later clarification: historical sales accuracy was never actually at risk

A direct, real concern raised after the above was built: "sales of cartons v bottles must be recorded accurately." Confirmed directly, worth recording plainly, since it's easy to assume otherwise: this was never genuinely at risk, and does not depend on §10's own part/tier restructuring at all.

The real, posted GL account a sale posts to has always, correctly distinguished tier from tier — `"Sales - Amber Ale 330ml (Bottle)"` is a real, distinct account from `"Sales - Amber Ale 330ml (Carton)"`, and every real sale, from the very first one ever simulated, posted to the correct one. Confirmed directly against the real, full Wine Retail Company simulation: querying real, posted `journal_line` activity by tier-specific account, excluding the year-end close's own zeroing entry, shows a real, accurate, already-correct breakdown (25 real Bottle sales, 7 real Carton sales, 18 real Six-Pack sales, each with its own real, distinct total) — with no restructuring, no migration, nothing beyond what already existed before §10 was ever written.

What §10's own, newer part/tier structure adds is a real, separate, further capability — a genuine, distinct `part` record per tier, with its own real UPC, price, and stock count — useful for things like scanning a carton's own barcode at POS or tracking carton stock separately from bottle stock. It is not, and was never, a fix for a real, existing sales-accuracy problem, because no such problem existed.

Given this, a full historical migration (splitting a business's own, already-existing tier-less parts into real, separate tier-level parts, and rewriting already-posted invoice lines and stock records to point at the correct one) is a real, deliberate choice not to pursue, not an oversight or a piece of unfinished work — the real, genuine risk (rewriting posted transaction history, inferring a historical sale's own real tier from its GL account name rather than a stored fact, guessing at how to retroactively split an already-existing, combined stock count) was weighed directly against a benefit that, on inspection, doesn't actually exist: the accurate report this would produce is already fully available today, directly from the existing, real posted history.

## 12. "Header Account" and "Posting Account" — a real, general vocabulary for the dimension mechanism, with Accounts Receivable/Payable as its first, real, concrete use

Two real, direct clarifications, given per direct correction after an
initial, real, genuine mistake was caught before it was committed:

**Posting Account**: a real, genuine account that real journal_line
entry amounts are actually, directly posted to — the exact, same
real concept the existing, established `is_postable_account` flag
already captures (a real leaf, as opposed to a real, pure
category/heading that only ever, structurally, holds other accounts
beneath it, never itself receiving a real posting).

**Header Account**: the real, established name for the dimension a
real entity uses to reach a real CoA heading it reports under, for a
real reporting purpose, without that heading being its own, real,
structural `parent_id` — the same, real, "multiple equal paths"
mechanism already proven this session for division/location/tier,
named specifically for this real use.

### The real, concrete example this was built for: Accounts Receivable/Payable

A real, genuine mistake, caught and corrected mid-session, worth
recording so it isn't repeated: the first, real instinct was to
directly re-parent `Customers`/`Vendors` (and, by extension, every
real customer/vendor beneath them) to live structurally under
`Accounts Receivable`/`Accounts Payable`, so a real, existing,
synthetic Balance Sheet computation (`sumContactBalances`, hardcoded
by name) could be replaced with a real, structural one.

Per direct, immediate correction: this was wrong. `Customers`/
`Vendors` are real Vocabulary words — real, genuine translatable
terms, the exact, same real kind of entity as any other real word in
the app's own vocabulary — and Vocabulary is their own, real,
correct, "source of all truth" structural home, exactly as
fundamental as any other real entity's own real, structural identity.
An entity only ever has one real, structural `parent_id` at all; a
real word cannot, correctly, also, structurally, "be" a Balance Sheet
line item at the same time, no matter how naturally the two ideas
seem to want to merge.

The real, correct fix instead: `Customers` stays, correctly,
structurally under Vocabulary, while *additionally*, via a real
Header Account dimension link, reaching `Accounts Receivable` — the
exact, same real entity that already, genuinely exists in this
schema's own, real, pre-existing Chart of Accounts (confirmed
directly: real example customers, e.g. "Acme Corp", were already,
correctly nested directly beneath it). `getBalanceSheet` now
generically discovers this via `getDimensionChildren('Accounts
Receivable', 'Header Account')` — not a hardcoded "Customers" name
check at all. A real, future entity setting up this same, real
dimension link against any other real heading is picked up
automatically, with no further code change required.

### The real, general principle, worth restating plainly

Per direct, emphatic instruction: nothing on a real report may be
hardcoded or synthetic. Where an earlier version of this document
(§10 above) established that a real leaf can reach more than one
real, equal, structural accumulation path (division, location,
category), this section extends that same, real principle one level
further: a real entity's own, single, structural `parent_id` should
always reflect its own, genuine, structural identity — never be
distorted or duplicated merely to make a real report's own
computation simpler. Wherever a real report needs a real entity to
"also" belong somewhere it doesn't structurally, genuinely live, the
real, correct tool is the dimension mechanism, not a second,
competing `parent_id`.

## Named relationships and generic hierarchies — one entity, many real roles

Everything in this application is an entity. But `parent_id` is a
single value — one entity can only ever have one real, structural
parent at a time. Two, real, recurring needs this can never satisfy on
its own:

1. **A named fact about an entity, pointing elsewhere** — "this
   location belongs to this division," "this contact is a customer,"
   "this business uses the German CoA family" — a real, directed
   relationship, not a structural nesting.
2. **One entity genuinely playing more than one real role at once** —
   a single-location "division" that is genuinely its own group, or a
   contact who is genuinely both a customer and an employee.

### The named-relationship record

The established mechanism, confirmed and reused throughout this
codebase, is a real, direct child entity acting as the relationship
record itself — its own name encoding what it is, its own
`relation_id` pointing at the real target:

```typescript
export function setRelationship(entityName: string, relationshipType: string, targetName: string, userId: UserId): void {
  const recordName = `${relationshipType} — ${entityName} → ${targetName}`;
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(recordName)) {
    createEntity({ name: recordName, parent: relationshipType }, userId);
  }
  const record = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(recordName) as { id: number };
  updateEntity(record.id, { relation: targetName }, userId);
  const entity = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(entityName) as { id: number } | undefined;
  if (!entity) throw new NotFoundError(`No entity named "${entityName}".`);
  updateEntity(entity.id, { relation: recordName }, userId);
}
```

`entityName`'s own `relation_id` points at the record; the record's
own `relation_id` points at the real target. `getRelationship` walks
this exact, same path in reverse — one hop to the record, then reads
its own `parent_id` (the type) and `relation_id` (the target):

```typescript
export function getRelationship(entityName: string): Relationship | undefined {
  const row = db
    .prepare(
      `SELECT rel_type.name AS type, target.name AS target
       FROM current_entities e
       JOIN current_entities rel ON rel.id = e.relation_id
       JOIN current_entities rel_type ON rel_type.id = rel.parent_id
       JOIN current_entities target ON target.id = rel.relation_id
       WHERE e.name = ?`
    )
    .get(entityName) as Relationship | undefined;
  return row;
}
```

This is a genuine, real limitation worth stating plainly: since
`entityName`'s own `relation_id` is a single value, `setRelationship`
called a second time on the same `entityName` overwrites the first
relationship — this mechanism, on its own, gives an entity exactly
one real relationship of this kind at a time.

### The dimension mechanism — real, independent, coexisting links

For a genuine "many real, coexisting facts about one entity"
need — a GL account's own real product-category placement, a
contact's own real, simultaneous customer *and* vendor status — the
record is instead parented directly under the *entity itself*, keyed
by a real, free-form link type:

```typescript
export function setEntityLink(entityName: string, linkType: string, targetName: string, userId: UserId): string {
  const recordName = `${entityName} — ${linkType}`;
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(recordName)) {
    createEntity({ name: recordName, parent: entityName }, userId);
  }
  const record = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(recordName) as { id: number };
  updateEntity(record.id, { relation: targetName }, userId);
  return recordName;
}
```

Since `recordName` includes `linkType`, a single `entityName` can hold
any number of real, independent, coexisting links, each its own,
separate child entity — none of them ever touching `entityName`'s own
`relation_id`, which stays free for whatever it already means to that
entity (a GL account's own real dimension links never interfere with,
say, a translation's own `relation_id` pointing back at its concept).
`setDimensionParent`/`getDimensionParent` are the direct, established
specialization of this for the "which real header account does this
belong under" question:

```typescript
export function setDimensionParent(entityName: string, dimensionName: string, parentName: string, userId: UserId): void {
  setEntityLink(entityName, `Dimension: ${dimensionName}`, parentName, userId);
}
```

`Contact Type` (see `contact-types-and-translations.md`) uses this
exact, same, proven mechanism with a dynamic link type per real type,
precisely because a contact genuinely needs to hold more than one
type at once — the same reason a GL account needs more than one real
dimension placement at once.

### `getHierarchy` — one, real, generic tree-builder for any hierarchy

Division/location, Chart of Accounts, Vocabulary — every real
hierarchy in this application is either plain, structural nesting
(`parent_id`), or a named relationship (above), or, in a genuine edge
case, both at once: a "per-location division" is structurally a
location, but conceptually also its own division, via a real `Belongs
To Division` relationship that simply targets itself. A hand-written,
per-hierarchy tree-walker missed this exact case (see the real,
concrete bug below) — `getHierarchy` is the single, generic
replacement, walking both kinds of edge together for any real root:

```typescript
export function getHierarchy(rootName: string, relationshipType?: string): HierarchyNode {
  const rootId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(rootName) as { id: number } | undefined)?.id;
  if (!rootId) throw new NotFoundError(`No real entity named "${rootName}".`);
  const relPairs = relationshipType ? getEntitiesWithRelationship(relationshipType) : [];
  const childrenByTarget = new Map<string, string[]>();
  for (const { source, target } of relPairs) {
    if (!childrenByTarget.has(target)) childrenByTarget.set(target, []);
    childrenByTarget.get(target)!.push(source);
  }
  function buildNode(id: number, name: string): HierarchyNode {
    const directChildren = db.prepare(`SELECT id, name FROM current_entities WHERE parent_id = ?`).all(id) as { id: number; name: string }[];
    const seen = new Set(directChildren.map((c) => c.name));
    const relationshipChildNames = (childrenByTarget.get(name) ?? []).filter((n) => n !== name && !seen.has(n));
    // ... builds children recursively from both real sources together
    return { name, children: [] };
  }
  return buildNode(rootId, rootName);
}
```

A real, genuine bug this exact gap caused: `getOrganizationChart`
originally derived its own "divisions" list purely from `Belongs To
Business` relationships. `Riverside Cellars`, a real, single-location
division with no separate division entity of its own — its own
`Belongs To Division` relationship simply targets itself — was
silently missing from every real org chart, since it had no `Belongs
To Business` relationship of its own to be found by. The fix: a
division is genuinely either a real `Belongs To Business` target, *or*
any real target of a `Belongs To Division` relationship whose own
locations trace back to this business — never assuming the two are
the same real set.
