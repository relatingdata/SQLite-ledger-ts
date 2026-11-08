
# Chapter 4 — A Second Business: Manufacturing

The Retail tutorial (Chapter 3) walked through a wine retailer: buy
bottles, sell bottles. This application is not limited to retail —
this chapter walks through a genuinely different kind of business, a
window and door manufacturer, to show the same application handling a
real, physical production process: raw materials in, assemblies out,
assemblies sold.

## Setting up the business

We create a brand-new business, "Tutorial Window & Door Manufacturing",
exactly the same way Chapter 3 created the wine retailer — the same
"Create Business" screen, the same banking wizard. Instead of one shop
floor, this business has two real storage locations: a "Raw Materials
Store" (everything bought from suppliers lands here) and a "Finished
Goods Store" (everything built and ready to sell lives here).

One real supplier, Statewide Timber & Glass Supplies, and one real
trade customer, BuildRight Constructions Pty Ltd, round out the setup.

## Items and the Bill of Materials

Six raw materials are created — Aluminum Extrusion, Glass Pane, and
Hardware Kit for windows; Timber Stile, Timber Rail, and Door Hardware
Kit for doors — alongside four assemblies: the Aluminum Window Frame,
and three door frames (Wooden Front, Wooden Rear, and Wooden Internal
Door Frame).

Each assembly's own **Bill of Materials** — the same "Bill of
Materials" card already on the Items page, used here for the first
time by this tutorial — records exactly which raw materials, and how
many of each, go into building one unit:

| Assembly | Components |
|---|---|
| Aluminum Window Frame | 4 × Aluminum Extrusion, 1 × Glass Pane, 1 × Hardware Kit |
| Wooden Front Door Frame | 2 × Timber Stile, 3 × Timber Rail, 1 × Door Hardware Kit |
| Wooden Rear Door Frame | 2 × Timber Stile, 3 × Timber Rail, 1 × Door Hardware Kit |
| Wooden Internal Door Frame | 2 × Timber Stile, 2 × Timber Rail |

Notice the Internal Door Frame's own Bill of Materials is deliberately
simpler than the Front/Rear ones — no external lockset (Door Hardware
Kit) is needed on a door that never faces the weather. This is a real,
visible example of how one Bill of Materials can vary, line by line,
between otherwise-similar products.

## Buying raw materials

Raw materials are bought from the supplier with real cash and received
into the Raw Materials Store, exactly the same two real steps (a
journal entry, then a stock receipt) any purchase in this application
uses — buy a little more of each raw material than this run's own
production actually needs, so there is a real, visible buffer of stock
left over afterward.

## Assembling

Assembly itself is modeled as two real, physical stock movements: the
exact raw materials a batch of assemblies needs come out of the Raw
Materials Store, and the finished assemblies go into the Finished
Goods Store. A journal entry records the real cost of what moved — the
assembly's own account is debited for its Bill of Materials' real,
computed cost, and each raw material's own account is credited for
the portion it contributed. Nothing is invented here: the Bill of
Materials you set up above is the one and only source for how much of
each raw material gets consumed, and for how much the finished
assembly is worth.

## Selling

Finished assemblies are sold to BuildRight Constructions for a real
sale price, and a real Cost of Goods Sold entry is posted using the
assembly's own cost — then the sold assemblies physically leave the
Finished Goods Store. Trial Balance, Balance Sheet, and Profit and
Loss all check out, exactly the way they did for the wine retailer in
Chapter 3 — a different business, the same real accounting underneath.

## Running it yourself

```
make test-e2e-manufacturing-tutorial          # fast — no browser
make test-e2e-manufacturing-tutorial-browser  # the same tutorial, through a real browser
```

And, for a heavier, repeated proof — the same purchase/assemble/sell
cycle run three times in a row against one fresh database, checked by
real, computed rules (nothing left negative, every raw material's own
leftover buffer stock adds up correctly, every assembly produced was
also sold, the business is profitable) rather than one fixed, hardcoded
number:

```
make test-e2e-manufacturing-full
```
