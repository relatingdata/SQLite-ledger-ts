# Wine Bar / Bistro Expansion: Assemblies (Cocktails, Wine by the Glass, Spirits by the Nip)

## The real business scenario

Wine Retail Company wants to branch into a wine bar/bistro: selling wine
by the glass, cocktails, and spirits by the nip with mixers and ice —
none of which exist as their own stocked, orderable products. Each one
is *assembled at the moment of sale* from existing stock: a bottle of
gin, a can of tonic, a bottle of the house red.

## What LedgerSMB actually calls this, and its real, documented rules

LedgerSMB's manual defines an **Assembly**: a product manufactured on
site, consisting of a selection of parts, services, and/or labor and
overhead. Two real, direct rules from their documentation:

1. **You cannot order an assembly from a vendor.** You order and stock
   its components; the assembly itself is only ever produced internally.
2. **For continuously-produced items, LedgerSMB's own dev manual
   documents a real, standard workaround**: rather than pre-batching
   stock of the finished assembly, create the assembly and "regularly
   restock the assembly to 0" — meaning it's never actually held in
   inventory; each sale immediately, invisibly reconstitutes and
   reconsumes it. This is exactly the right model for a cocktail: nobody
   pre-pours 50 gin & tonics and shelves them.

## Mapping onto this project's real, existing Item hierarchy

A "Gin & Tonic" becomes a real Item, same as any other — sitting in
the Category → Product → Item hierarchy already established, so it
shows up on menus, POS, invoices, and reports exactly like a bottle of
wine does. What's genuinely new: this Item needs to record **what real
components it consumes, and in what quantity**, so a sale can (a) show
a sensible price built from real cost, and (b) decrement the *right*
stock — the bottle of gin and the can of tonic, not "Gin & Tonic"
itself, which is never actually stocked.

## The real gap, found directly in source, and the no-new-tables fix

`setEntityLink`/`getEntityLink` (already used for Storage Origin)
stores exactly one target per link — perfect for "this Item's storage
is Cold," useless as-is for "this Item is made from three different
components, each in a different amount." And the base `entities` table
has no numeric column to hang a quantity off of.

The direct, no-new-tables fix: extend the *existing* naming convention
one step further. Storage Origin links are named
`"{item} — Storage Origin"`. A BOM component link would be named
`"{item} — BOM: {component name}"`, with its **quantity encoded in the
link entity's own name** as a parseable suffix — e.g.
`"Gin & Tonic — BOM: Gin (30ml)"` — mirroring how quantities already
appear as plain suffix text elsewhere in this codebase's item naming
(`"Amber Ale 330ml"`). A real function, `getBomComponents(itemName)`,
would list every child entity under the item whose name matches the
`" — BOM: "` pattern, parse out the component name and quantity from
each, and return a real, typed array — no new table, no new column,
same mechanism already proven for Storage Origin.

## Real, direct findings on actual bar equipment (not guessed)

- **Beer is served from a keg**, not individual bottles — a shared CO2
  tank + regulator pushes beer through a line to a tap. One real keg
  serves many, many individual glasses.
- **Soft drinks are typically "post-mix"**: a bag-in-box (BIB) syrup
  concentrate is combined with carbonated water at the point of
  dispensing (via the same shared CO2 supply, through a carbonator and
  a BIB pump) — never poured from individual bottles/cans at a proper
  bar setup.
- **CO2 is one real, shared consumable** serving both the beer taps and
  the post-mix soda system — not a separate gas supply per drink.
- **Real, standard Australian beer glass sizes**: Pot/Middy (285ml),
  Schooner (425ml), Pint (570ml) — the same keg is poured into
  different-sized glasses, each its own separately priced menu item,
  each consuming a different ml amount from the same real keg stock.

This changes the BOM design directly: rather than "Amber Ale (Pot)"
consuming a fraction of a 330ml bottle, it consumes 285ml from a real
"Amber Ale Keg" component — a different, new kind of stocked Item
(large-format, dispensed by volume) alongside the existing bottled
retail product.

## Real data-entry screen design

A new fieldset section on the existing Items Catalog detail panel
(`items/+page.svelte`), shown only when editing an Item flagged as an
assembly (a simple boolean toggle, itself another `setEntityLink`-style
tag, e.g. `"{item} — Is Assembly"` → `"Yes"`):

```
┌─ Bill of Materials ──────────────────────────────────────┐
│ ☑ This item is an assembly (built from other items)      │
│                                                             │
│  Component            Quantity      Unit                  │
│  [Gin ▾]              [30    ]      [ml ▾]      [Remove]  │
│  [Tonic Water ▾]      [150   ]      [ml ▾]      [Remove]  │
│  [+ Add component]                                         │
│                                                             │
│  Estimated cost: $2.15  (from current component prices)   │
└─────────────────────────────────────────────────────────┘
```

- **Component** — a real Item picker, scoped to the current business's
  own Items (same pattern as the existing Vendor-matching dropdown on
  Purchase Order).
- **Quantity / Unit** — plain numeric input + a small, fixed unit
  dropdown (ml, g, unit, nip, glass) — stored together as the link
  name's parenthetical suffix.
- **Estimated cost** — computed live, client-side, by summing each
  component's current per-unit cost × the BOM quantity — a real,
  useful number, not stored anywhere new.
- **Remove** — deletes that one link entity (`deleteEntityLink`).

At the point of sale (Cash Sale / POS), selling one "Gin & Tonic"
would — per the real LedgerSMB "restock to 0" pattern — immediately,
invisibly decrement Gin and Tonic Water's own real stock by the BOM
quantities, rather than decrementing any stock held under "Gin & Tonic"
itself (which never holds real stock at all).

## Honest, direct open questions, not yet resolved

- Fractional consumption of a whole bottle (30ml out of a 700ml
  bottle) needs the existing stock-quantity model to genuinely support
  non-integer amounts — not yet confirmed whether it already does.
- Ice, garnish, and glassware are real, physical inputs with
  effectively negligible/non-tracked cost — LedgerSMB's own
  Services/Labor-overhead distinction may be the right home for these
  rather than forcing them into the BOM as a "component" with its own
  stock.
- Whether "restock to 0" should be a real, automatic behavior baked
  into the Cash Sale/POS commit path, or a separate, explicit "Produce
  Assembly" action a staff member runs at the end of a shift, matching
  LedgerSMB's own, more manual, non-real-time original design.
