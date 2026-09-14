*A Claude Code skill for this project — lives at `/mnt/skills/user/no-new-tables/SKILL.md`, reproduced here so it's part of this manual's own, single, complete source. Description: MANDATORY, absolute, for this project - before adding a new SQL table, stop and check whether the real capability can instead be built from the existing entity-tree and link-entity mechanisms (a new entity, a new relation_id link, a new 1:1-entity-extension table following the contact/division/account pattern). New tables are a last resort, not a default reach, and every real instance of "we thought we needed a new table" in this project's own history turned out to be buildable from what already exists.*


# No New Tables

## Why this is a real, load-bearing principle, not a stylistic preference

This project's entire, real architecture rests on a small number of generic mechanisms — a single entity tree (`current_entities`), a generic `relation_id` link for "this entity is a translation of / belongs to / is a variant of that one," and a small set of real, 1:1-entity-extension tables (`contact`, `division`, `account`) that attach richer, typed detail to an entity without inventing a new, parallel identity system. Every new *kind* of business fact this project has needed so far has been expressed through these same mechanisms, not a bespoke new table.

## The real, concrete evidence

- **Currency as a commodity** (`docs/multicurrency-design.md`, `backend/scripts/prototype-multicurrency.ts`): foreign currency (EUR, USD) is modeled as a real `Item` entity, using the *existing* `stock_lot`/`receiveLot`/`consumeFromLots` mechanism already built for wine — not a new `currency_holding` table.
- **Exchange rates as a delivery-fee template**: the design reuses the *existing* `item_source.package_quantity` field to convert an order's base-unit quantity into a carton count for fee calculation — not a new `conversion_ratio` table.
- **Per-product quantity accounts** (`On Order`, `Units Sold`, `Count Adjustment`, `Write-off`) — each a real, plain entity under the product's own entity, using the same, generic account/balance mechanism every other account uses — not a dedicated `product_quantity_tracking` table.
- **Location types, address types, phone types** — real Vocabulary words under a real parent entity, linked via `relation_id` — not an enum column or a dedicated lookup table per type category.
- **Back orders** (`placeOrder`/`fulfillOrder`) — read directly as whatever remains on a real `Qty`/`Value` account pair, never stored as its own, separate "back order" table or flag.

## The real, absolute rule

1. **Before proposing a new table**, ask directly: can this be a new entity, a new `relation_id` link, or a new column on an *existing* 1:1-entity-extension table (`contact`, `division`, `account`)?
2. **A new 1:1-entity-extension table is acceptable** when a genuinely new *kind* of entity needs its own, real, structured detail that doesn't fit any existing extension (e.g. a hypothetical new `business` extension table for `home_currency`/`country`, per `docs/multicurrency-design.md`'s own proposal) — this is different from a bespoke, purpose-built table for one narrow feature.
3. **If a new table still seems necessary after that check**, name directly why the entity-tree/link/extension mechanisms genuinely can't express the real fact being modeled — not just that a dedicated table would be more convenient or more familiar from other systems.

## When this doesn't apply

Genuine, structural, shared infrastructure the entity tree itself depends on (`current_entities`, `entity_update`, `journal`, `journal_line`, `journal_entry_staging`) is not itself subject to this rule — this skill governs new *business capabilities*, not the foundational tables those capabilities are built on top of.
