# Chapter 4b --- The Manufacturing Tutorial, in the Terminal

Chapter 3b showed the terminal (text) user interface against the wine retailer, screen for screen. This chapter does the same, full, complete walk for the **Tutorial Window & Door Manufacturing** business instead --- the same real terminal client, the same real backend, a genuinely different kind of business behind it, and (per direct correction to an earlier, thinner draft of this chapter) every one of the same eighteen real screens Chapter 3b documents, captured fresh against this business's own real data rather than skipped as merely "identical."

**The TUI has the same screens Chapter 3b names**; those generated from the same descriptions as the web app's screens (Purchase, Cash Purchase, Purchase Order, AR Sale, Cash Sale, Balance Sheet and the other reports) ask for the same fields in the same order. None of those screens are business-type-specific --- every one is the exact same real mechanism, just reflecting this manufacturer's own real data: three real storage locations (a warehouse for raw materials, the real Factory floor, a warehouse for finished goods) instead of a wine retailer's single shop, eight real Departments and ten real Employees across those workshops, five real Item Categories, a real "Process" Other Hierarchy, and a Balance Sheet carrying far more real inventory accounts than one shop ever needs.

**There is still no TUI screen at all for Items, the Bill of Materials, or Transfer Items.** Chapter 4's own web story is built around the Items page's BOM card --- creating every raw material (including the two real 6.1 metre bulk lengths this factory buys timber and aluminum extrusion in), defining each assembly's exact component list (including the fractional BOM lines that cut a bulk length down into ordinary stock), assembling, and selling --- and around the real Transfer Items screen that moves stock between the three real locations. None of that has a terminal screen yet. That is the one real, honest gap this chapter exists to name plainly, not paper over: the web app remains the only way to set up or inspect a Bill of Materials, or to move stock between locations, today.

Every transcript below is real text, captured directly from a live, passing run of the real terminal program --- never hand-typed --- against the exact same **Tutorial Window & Door Manufacturing** business this manual's Chapter 4 builds (created fresh via the same, shared `shared-fixtures/manufacturing-tutorial-steps.csv` fixture, run through the fast, backend-only `--path api` route rather than re-driven screen by screen). A terminal's own natural "screenshot" is its real text output, captured with `terminal.text()` against a genuine, running `@microsoft/tui-test` session rather than a bitmap of one --- see `backend/scripts/capture-manufacturing-tui-transcripts.ts`, run fresh by `make tutorial-section-user-manual-manufacturing-tui`.

## Logging in

The same account, the same backend --- just a different, real client of it.

```
sql-ledger-ts — text user interface
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ sql-ledger-ts — Log in                                                                           │
│ Username                                                                                         │
│                                                                                                  │
│ Password                                                                                         │
│                                                                                                  │
│ Enter on Username moves to Password · Enter on Password logs in                                  │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

## Choosing a business, then a ledger

**Tutorial Window & Door Manufacturing** is listed with every other business the account can open, as Chapter 3b shows:

```
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Choose a business                                                                                │
│ ❯ Tutorial Window & Door Manufacturing                                                           │
│   New Business                                                                                   │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

Choosing it offers its own real ledgers --- the Actual ledger this tutorial trades in, and the Budget ledger created alongside it:

```
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Choose a ledger — Tutorial Window & Door Manufacturing                                           │
│ ❯ Actual                                                                                         │
│   Budget 2026-27                                                                                 │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

## The Menu

The same real, live, server-computed menu the web app renders --- same sections, same labels, the same standing rule that the GUI and TUI must line up completely. A section with no TUI screen behind any of its links yet (Logistics, Shipping, Vendors/Providers, and others) is still shown here, exactly as it is --- nothing is hidden --- it just says so plainly the moment you actually try to open one of those links.

```
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Menu — Tutorial Window & Door Manufacturing                                                      │
│ ❯ General Ledger                                                                                 │
│   Accounts Receivable (Debtors / Sales)                                                          │
│   Accounts Payable (Creditors / Purchasing)                                                      │
│   Inventory                                                                                      │
│   Cash                                                                                           │
│   Vouchers                                                                                       │
│   HR                                                                                             │
│   Logistics                                                                                      │
│   Shipping                                                                                       │
│   Projects & Jobs                                                                                │
│   Configuration                                                                                  │
│ ↑/↓ move · Enter open a section · q quit                                                         │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

## General Journal

The same real journal every one of this tutorial's own entries posts through --- the owner's $20,000.00 capital contribution, every raw-material purchase (including the two real bulk 6.1 metre lengths), both rounds of BOM reclassification, a weekly wage and overhead run against all eight real Departments' own Payroll/Other Expenses accounts, and every real sale. Reached fresh, before any line is staged:

```
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ General Journal — Tutorial Window & Door Manufacturing / Actual                                  │
│ Account                   Debit / Credit                                                         │
│ Total                     $0.00 debit / $0.00 credit                                             │
│ No lines staged yet — press I to add one.                                                        │
│ I add a line · ↑/↓ select · D delete selected · Enter posts (once balanced) · Escape back to     │
│ menu                                                                                             │
│                                                                                                  │
│                                                                                                  │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

## Balance Sheet

The same report as the web app's Balance Sheet, generated from the same description --- here it is reflecting the real, final state after every purchase, every bulk-length cut, both rounds of assembly, a full week's real wages and overhead across eight real workshops, and every real sale (including the three builder orders and a small, same-day spot sale of two extra frames) have posted. Fourteen real raw-material/assembly accounts are still carrying a genuine leftover buffer --- most visibly the Timber Rail and Timber Stile left over from cutting bulk timber lengths, and the Aluminum Extrusion left over from cutting bulk aluminum --- and the books are genuinely balanced:

```
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Balance Sheet                                                                                    │
│ For Actual only.                                                                                 │
│ As of date                                  blank keeps 2026-11-28                               │
│ Assets                                                                                           │
│                                Debit      Credit                                                 │
│ Cash and Bank                         (9 327.00)                                                 │
│ Inventory                  38 815.00                                                             │
│   Aluminum Extrusion        7 532.00                                                             │
│   Aluminum Sill                80.00                                                             │
│   Door Hardware Kit           135.00                                                             │
│   Door Slab - External        150.00                                                             │
│   Door Slab - Internal        140.00                                                             │
│   Glass Pane                  100.00                                                             │
│   Hardware Kit                 60.00                                                             │
│   Hinge Set                   120.00                                                             │
│   Internal Door Latch Kit      70.00                                                             │
│   Packaging Kit                40.00                                                             │
│   Sliding Door Track Kit      240.00                                                             │
│   Timber Rail              12 050.00                                                             │
│   Timber Stile             18 048.00                                                             │
│   Weatherseal Kit              50.00                                                             │
│ Total Assets               29 488.00                                                             │
│                                                                                                  │
│ Liabilities                                                                                      │
│                    Debit  Credit                                                                 │
│ None                                                                                             │
│ Total Liabilities                                                                                │
│                                                                                                  │
│ Equity                                                                                           │
│                        Debit     Credit                                                          │
│ Owner's Equity                20 000.00                                                          │
│ Current Year Earnings          9 488.00                                                          │
│ Total Equity                  29 488.00                                                          │
│                                                                                                  │
│ Total Liabilities + Equity  29 488.00                                                            │
│ ✓ Assets = Liabilities + Equity                                                                  │
│ Enter next / choose · ↑ previous · a blank field keeps its default · Escape back to menu         │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

Cash and Bank shows negative here --- a real, honest result of this business trading entirely in cash this early in its own story (every purchase, every wage, every sale moves through it, never a bank loan), not a display bug. Note too that the day's real cutting-shop output genuinely dwarfs what the three builder orders and the one small spot sale actually consumed: the Timber Stile/Rail and Aluminum Extrusion lines above are mostly real, unsold, on-hand buffer stock left over from cutting bulk lengths --- these three orders, by design, are a modest slice of a normal day's real output from these eight workshops, never the whole of it.

## New Business

The same real wizard, reached the same real way --- shown here only at its own first, real step (naming the new business); this chapter doesn't carry a second business through creation, so as not to disturb the one real Manufacturing business every other screen below is captured against.

```
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ New Business — name                                                                              │
│                                                                                                  │
│ Enter continues · Escape cancels                                                                 │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

## Business Structure

The same real, three-step popup Chapter 3b documents --- Org Chart, Item Categories, and Other Hierarchies --- stepped between here with ←/→ instead of Back/Next buttons. This business's own real story genuinely differs from the wine retailer's: a real factory floor behind every one of the three orders above, not just a shop and a head office.

**Org Chart** --- three real locations across two real Divisions (**Production**, carrying the Factory floor; **Warehousing**, carrying both the Raw Materials Store and the Finished Goods Store), and all eight real Departments --- one per workshop, the four window workshops (Aluminum Cutting, Aluminum Assembly, Wood Cutting, Wood Assembly), the two glass workshops (Glass Cutting, Glazing), the Door Framing & Lock Fitting workshop, and the two-hand Packaging bay:

```
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Org Chart — Tutorial Window & Door Manufacturing                                                 │
│ Divisions                                                                                        │
│ › Production (1)                                                                                 │
│   Warehousing (2)                                                                                │
│   Unassigned (no division) (0)                                                                   │
│ Departments                                                                                      │
│   Aluminum Assembly (1)                                                                          │
│   Aluminum Cutting (1)                                                                           │
│   Door Framing & Lock Fitting (2)                                                                │
│   Glass Cutting (1)                                                                              │
│   Glazing (1)                                                                                    │
│   Packaging (2)                                                                                  │
│   Wood Assembly (1)                                                                              │
│   Wood Cutting (1)                                                                               │
│   Unassigned (no department) (0)                                                                 │
│ ↑/↓ highlight · Enter open a bucket · I add Location/Division/Department · D delete highlighted  │
│ (not Unassigned) · ←/→ Item Categories / Other Hierarchies · Escape back to menu                 │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

Door Framing & Lock Fitting and Packaging both carry two real employees (a craftsman plus, respectively, the floor supervisor and a second packaging hand) --- every other workshop above, one.

**Item Categories**, one step over, carries five real categories every one of this business's real items (raw materials, hardware and fittings, the two real bulk lengths, frame assemblies, and complete units) is tagged into:

```
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Item Categories — Tutorial Window & Door Manufacturing                                           │
│ › Bulk Lengths                                                                                   │
│   Complete Units                                                                                 │
│   Frame Assemblies                                                                               │
│   Hardware & Fittings                                                                            │
│   Raw Materials                                                                                  │
│ ↑/↓ highlight · Enter drill in · I add a category here · D delete highlighted · ←/→ Org Chart /  │
│ Other Hierarchies · Escape back to menu                                                          │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

And Other Hierarchies carries a real **Process** hierarchy --- which production stage each item belongs to (Cutting, Glazing, Framing & Lock Fitting, Packaging), independent of, and coarser than, the eight Departments' own workshop-level granularity:

```
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Other Hierarchies — Tutorial Window & Door Manufacturing                                         │
│ › Process (4)                                                                                    │
│ ↑/↓ highlight · Enter open · I add a hierarchy · D delete highlighted · ←/→ Org Chart / Item     │
│ Categories · Escape back to menu                                                                 │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

## Purchasing

Four real screens, each shown here exactly as it first opens --- this chapter doesn't carry a purchase, payment, or order through to completion on this business's own real books, so as not to disturb the figures the Balance Sheet above, and the web chapter's own figures, both depend on.

**Purchase** (on account, from a real provider --- this business now has eleven of them, from Statewide Timber & Glass Supplies to Southern Cross Aluminum Extrusions, Adelaide Hills Timber Mill, and eight more, each mapped to the specific materials they'd realistically sell):

```
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ AP Purchase                                                                                      │
│ A purchase from a provider on credit — debits an expense or asset account, credits their         │
│ Accounts Payable balance.                                                                        │
│ Tutorial Window & Door Manufacturing — Actual                                                    │
│ Date                                                                                             │
│ Reference                                               e.g. PO-1001                             │
│ Provider                  Select provider…                                                       │
│ Account (what this        Select account…                                                        │
│ purchase was for)                                                                                │
│ Tax %                                                                                            │
│ Location                  Not yet known                                                          │
│ Description                                             optional                                 │
│                                                                                                  │
│                                                                                                  │
│ Item                                                    e.g. Golden Lager 330ml                  │
│ Quantity                                                blank keeps 1                            │
│ Unit price                                                                                       │
│                                                                                                  │
│   Save                                                                                           │
│   Add another line                                                                               │
│                                                                                                  │
│ Enter next / choose · ↑ previous · a blank field keeps its default · Escape back to menu         │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

**Cash Purchase** (from the 'Cash' provider, posted and paid off in full the same instant) --- its location field chooses among this manufacturer's three locations, the Factory floor included:

```
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Cash Purchase                                                                                    │
│ A purchase from the 'Cash' provider — posted exactly like any on-account purchase, then paid off │
│ in full the same instant, so the balance is real even if only for a moment. Choose any real      │
│ location to receive stock at, including a warehouse — possibly the start of a real wholesale     │
│ channel.                                                                                         │
│ Tutorial Window & Door Manufacturing — Actual — Provider: Cash                                   │
│ Date                                                                                             │
│ Receive at location       Factory                                                                │
│                                                                                                  │
│                                                                                                  │
│ Item                                                    e.g. Golden Lager 330ml                  │
│ Quantity                                                blank keeps 1                            │
│ Unit price                                                                                       │
│ Tax                                                                                              │
│ Payment method            Cash                                                                   │
│                                                                                                  │
│   Complete purchase                                                                              │
│   Add another line                                                                               │
│                                                                                                  │
│ Enter next / choose · ↑ previous · a blank field keeps its default · Escape back to menu         │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

**Purchase Order** (a memo-only commitment to buy --- no real ledger effect until a Stock Receipt fulfills it):

```
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Purchase Order                                                                                   │
│ Commits to buying from a provider — memo only, no real ledger effect until a Stock Receipt       │
│ fulfills it (all or item).                                                                       │
│ Tutorial Window & Door Manufacturing — Actual                                                    │
│ Date                                                                                             │
│ Reference                                               e.g. PO-1001                             │
│ Item                      Select item…                                                           │
│ Provider                  Select provider…                                                       │
│ Quantity                                                                                         │
│ Price per unit                                                                                   │
│ Delivery location         Not yet known                                                          │
│ Description                                             optional                                 │
│                                                                                                  │
│                                                                                                  │
│   Save                                                                                           │
│                                                                                                  │
│ Enter next / choose · ↑ previous · a blank field keeps its default · Escape back to menu         │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

**Payment** (to a provider --- debits their Accounts Payable balance, credits Cash and Bank):

```
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ AP Payment — Tutorial Window & Door Manufacturing / Actual                                       │
│ A payment to a provider — debits their Accounts Payable balance, credits Cash and Bank.          │
│ Reference                                                                                        │
│ Enter continues · Escape back to menu                                                            │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

## Sales

**AR Sale** (reached from the menu's **Sale** link --- a sale to a customer on credit):

```
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ AR Sale                                                                                          │
│ A sale to a customer on credit — debits their Accounts Receivable balance, credits Sales         │
│ Revenue.                                                                                         │
│ Tutorial Window & Door Manufacturing — Actual                                                    │
│ Date                                                                                             │
│ Reference                                               e.g. INV-1001                            │
│ Customer                  Select customer…                                                       │
│ Tax %                                                                                            │
│ Location                  Not yet known                                                          │
│ Description                                             optional                                 │
│                                                                                                  │
│                                                                                                  │
│ Item                                                    e.g. Golden Lager 330ml                  │
│ Quantity                                                blank keeps 1                            │
│ Unit price                                                                                       │
│                                                                                                  │
│   Save                                                                                           │
│   Add another line                                                                               │
│                                                                                                  │
│ Enter next / choose · ↑ previous · a blank field keeps its default · Escape back to menu         │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

**Cash Sale** (to the 'Cash' customer, posted and paid off in full the same instant) --- the same three locations to dispatch from:

```
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Cash Sale                                                                                        │
│ A sale to the 'Cash' customer — posted exactly like any on-account sale, then paid off in full   │
│ the same instant, so the balance is real even if only for a moment. Choose any real location to  │
│ dispatch from, including a warehouse — possibly the start of a real wholesale channel. The       │
│ everyday retail register is the real POS Terminal; this is the same real mechanism for a larger, │
│ non-register sale.                                                                               │
│ Tutorial Window & Door Manufacturing — Actual — Customer: Cash                                   │
│ Date                                                                                             │
│ Dispatch from location    Factory                                                                │
│                                                                                                  │
│                                                                                                  │
│ Item                                                    e.g. Golden Lager 330ml                  │
│ Quantity                                                blank keeps 1                            │
│ Unit price                                                                                       │
│ Tax                                                                                              │
│ Payment method            Cash                                                                   │
│                                                                                                  │
│   Complete sale                                                                                  │
│   Add another line                                                                               │
│                                                                                                  │
│ Enter next / choose · ↑ previous · a blank field keeps its default · Escape back to menu         │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

**Customers** --- a real, read-only browse of this business's own real, account-based customers: **BuildRight Constructions Pty Ltd** (two of the three builder orders, plus the small spot sale of two extra frames) and **Coastal Home Builders Pty Ltd** (the second, genuinely different builder's own townhouse-block order). The same real, honest limit Chapter 3b notes applies here too --- a new named customer is still only ever created through the Structured Editor or an API-side fixture step, never from this screen itself.

```
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Customers — Tutorial Window & Door Manufacturing                                                 │
│ Real, account-based customers — created today only via the Structured Editor or an API-side      │
│ fixture step, not from this screen.                                                              │
│ Enter opens a customer's details · Escape back to menu                                           │
│ ❯ BuildRight Constructions Pty Ltd                                                               │
│   Cash                                                                                           │
│   Coastal Home Builders Pty Ltd                                                                  │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

## POS Terminal

The everyday retail register, scoped to a real location of type Retail --- this manufacturer has none (every one of its three real locations is a warehouse or a factory floor, never a shop), so the screen says exactly that, plainly, rather than offer an empty or misleading picker:

```
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ POS Terminal — Tutorial Window & Door Manufacturing / Actual                                     │
│ The everyday retail register — a real location of type 'Retail'.                                 │
│ No real Retail-type location exists yet.                                                         │
│ Escape back to menu                                                                              │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

## What's still web-only

Everything above is real and current, captured from the real, running terminal program against this business's own real figures. Three real things Chapter 4's own web narrative covers still have no TUI screen at all, and this chapter doesn't pretend otherwise:

- **Items and the Bill of Materials.** Every raw material (including the two real bulk 6.1 metre lengths), every assembly, and every one of this tutorial's own BOM lines --- including the fractional ones (a real, `REAL`-typed quantity column, never an integer) that cut a bulk length down into ordinary Aluminum Extrusion, Timber Stile, or Timber Rail stock --- was set up and is still only inspectable through the web app's Items page. There is no terminal screen for any of it yet.
- **Transfer Items.** Every real movement of stock between this business's own three locations --- raw bulk lengths from the Raw Materials Store to the Factory floor, freshly cut stock back again, finished frames from the Factory to the Finished Goods Store --- happens through the same real `transferItems` mechanism the web app's own Transfer Items screen uses, but that screen itself has no terminal counterpart yet.
- Everything Chapter 3b already names as web-only for the wine retailer --- an item's own registered unit cost and pack size, Open/Close Container, the Close Books / Rollover To New Period sequence, and the Profit and Loss report grouped two ways --- remains exactly as web-only here. None of it is specific to retail or to manufacturing; it simply hasn't grown a terminal screen yet for either business.

Those steps remain exactly what Chapter 4 shows them as: real, exercised end to end by the automated Manufacturing tutorial test, through the web app.
