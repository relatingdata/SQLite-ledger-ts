# Design notes: Item terminology, Vocabulary-linked names, size property, storage hierarchy

Recorded directly, not yet implemented — captured mid-session so the
reasoning isn't lost before the actual migration is attempted.

## "Part" vs "Product" vs "Item"

Direct correction: "part is a 'part' for assembly or manufacturing —
Product is something finished, as in output and finished product — I
think a generic term like 'Item' as in inventory item is best."

This application's own current terminology (`Part`, `PartName`,
`createPart`, `getPartLocation`, etc. — confirmed via
`docs/function-inventory.md`) does not yet distinguish a raw
component from a finished, sellable good, and uses "Part" as if it
covers both. The real, correct, general term for what this
application actually tracks — anything that can be received, held in
inventory, and sold or consumed — is **Item**, matching the
established real-world sense of "inventory item." A future migration
should rename the `Part`/`PartName` branded type and its own family of
functions to `Item`/`ItemName` throughout — not as a cosmetic rename,
but because the wrong word invites the wrong mental model (a "part"
suggests something assembled into something else, which is not what
most of this application's own real, current usage means).

## Every name lives in Vocabulary, with a real link back

Direct instruction: "the names should all be stored in the vocabulary,
and a link to there."

This matches the already-established Vocabulary mechanism used
throughout this session (CoA family tags, contact types, division
types are all real Vocabulary words). The real, general principle to
apply consistently: any user-facing "name" that functions as a
*label* or *category* — not a one-off, freely-typed value — should be
a real Vocabulary entity, referenced via a real, named `Link` (the
primitive already built this session), never duplicated as a raw
string wherever it's used. This keeps every such name translatable,
user-extensible, and auditable from one, real, single source, exactly
the same reasoning already applied to CoA family tags and contact
types.

## Can/bottle size is a property, not part of the name

Direct correction: "I am now thinking that can and/or bottle sizes
500ml or 750ml etc is another Property."

Currently, a size like "500ml" is folded directly into an item's own
name string (e.g. "Amber Ale 330ml (Bottle)" — confirmed in
`ensureProductTierPart`'s own real usage this session). The real,
correct design: size should be its own real property (via a real
`Link` to a real Vocabulary word, or a numeric `Detail`/`Balance`-style
figure), the same way tier and unit-conversion/exchange-rate
properties were designed earlier this session. This is the same
"buying/selling price and a unit conversion are both `$/unit` exchange
rates" generalization applied one level further: a can/bottle size is
a real, structural fact about an item, not a decoration on its name.

## Storage type (shelf/fridge, hot/cold) is its own, separate hierarchy

Direct instruction: "storage consisting of shelf or fridge aliases hot
or cold is another hierarchy."

Distinct from `Location` (a physical place — a store, a warehouse) and
from `location capacity levels` (min/max/reorder/shelf level, already
built this session): a real, separate **Storage Type** hierarchy,
where "Shelf" and "Fridge" are real aliases for (children of, or
linked to) a real "Hot"/"Cold" distinction. An item stored at a given
location would then carry a real link to its own storage type,
independent of which physical location it sits in — the same
dimension-parent mechanism (`setDimensionParent`/`Link`) already used
for Location, Division, and COGS Product.

## Not yet implemented

None of the above has been built yet — this is a direct record of the
reasoning and the intended design, for a future session's real
migration work, following the same discipline as every other real
migration this session: convert, verify against the full backend
suite and full e2e tutorial, then commit — never all at once, blind.
